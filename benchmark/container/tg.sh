#!/usr/bin/env bash
# Containerised benchmark stack on a dedicated Podman machine. Nothing runs on the host.
#   benchmark/container/tg.sh up                      start the machine, Ollama and the network
#   benchmark/container/tg.sh build                   build the runner image
#   benchmark/container/tg.sh run <model> [suite...]  run suites (results land in benchmark/results)
#   benchmark/container/tg.sh pull <model>            download a model into the Ollama volume
#   benchmark/container/tg.sh down                    stop the containers and the machine
set -euo pipefail
cd "$(dirname "$0")/../.."
MACHINE=${TG_MACHINE:-toolgrade}
C="podman --connection $MACHINE"
OLLAMA_IMAGE=docker.io/ollama/ollama:0.40.16
RUNNER_IMAGE=localhost/toolgrade-runner:latest

ensure_machine() {
  if ! podman machine inspect "$MACHINE" >/dev/null 2>&1; then
    podman machine init "$MACHINE" --cpus 8 --memory 12288 --disk-size 60 --provider libkrun --volume "$PWD:$PWD"
  fi
  state=$(podman machine inspect "$MACHINE" --format '{{.State}}')
  if [ "$state" != "running" ]; then
    running=$(podman machine list --format '{{.Name}} {{.Running}}' | awk '$2=="true"{print $1}' | tr -d '*')
    if [ -n "$running" ]; then
      echo "Podman runs one machine at a time; '$running' is running. Stop it first (podman machine stop $running)." >&2
      exit 1
    fi
    podman machine start "$MACHINE"
  fi
}

case "${1:-}" in
  up)
    ensure_machine
    $C network exists tg-net || $C network create --internal tg-net >/dev/null
    $C volume exists tg-ollama || $C volume create tg-ollama >/dev/null
    if ! $C container exists tg-ollama; then
      $C run -d --name tg-ollama --network tg-net \
        -e OLLAMA_FLASH_ATTENTION=1 -e OLLAMA_KV_CACHE_TYPE=q8_0 -e OLLAMA_HOST=0.0.0.0:11434 \
        -v tg-ollama:/root/.ollama "$OLLAMA_IMAGE" serve >/dev/null
    else
      $C start tg-ollama >/dev/null
    fi
    $C exec tg-ollama ollama list
    ;;
  build)
    $C build -t "$RUNNER_IMAGE" -f benchmark/container/Containerfile .
    ;;
  pull)
    # Pulling needs the internet, which tg-net deliberately lacks: use a one-off container.
    $C run --rm -v tg-ollama:/root/.ollama --entrypoint sh "$OLLAMA_IMAGE" -c "ollama serve >/dev/null 2>&1 & sleep 3; ollama pull ${2:?model}"
    ;;
  run)
    MODEL=${2:?model}; shift 2
    mkdir -p benchmark/results
    $C run --rm --network tg-net \
      --read-only --tmpfs /tmp:rw,size=512m --cap-drop ALL --security-opt no-new-privileges \
      -e OUT_DIR="${OUT_DIR:-}" -e LOCAL_MODEL=1 \
      -v "$PWD/benchmark/results:/toolgrade/benchmark/results:rw" \
      "$RUNNER_IMAGE" openai "$MODEL" http://tg-ollama:11434/v1 "$@"
    ;;
  down)
    $C stop tg-ollama >/dev/null 2>&1 || true
    podman machine stop "$MACHINE"
    ;;
  *)
    sed -n '2,8p' "$0"
    exit 1
    ;;
esac
