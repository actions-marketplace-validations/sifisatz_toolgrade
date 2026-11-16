// Failure analysis written from the trial trajectories in benchmark/results/2026-11-16-qwen3-8b.
// Each finding names the task and score so it can be checked against the raw reports.

export interface Finding {
  server: string;
  task: string;
  score: string;
  title: string;
  observed: string;
  lesson: string;
}

export const FINDINGS: Finding[] = [
  {
    server: "sequential-thinking",
    task: "all reasoning tasks",
    score: "no lift",
    title: "The model solved everything without the scaffold",
    observed:
      "All five multi-step problems passed 3/3 with and without the tool, so lift is zero. The model still made about 0.7 tool calls per task, and once called it for 17 * 23 - right answer, but a tool call the control task does not allow.",
    lesson:
      "A reasoning scaffold has to beat the model thinking alone. Here it added calls and tokens with no accuracy gain - harder problems or weaker models may differ, which is exactly what a no-tool baseline is for.",
  },
  {
    server: "memory",
    task: "recall-lead",
    score: "0/3 with tools",
    title: "An optional 'hide the data' parameter hid the answer",
    observed:
      "In all three trials the model called search_nodes with observationLimit: 0. It found Dana Reyes as the project lead, but the entity's observations - including 'Ships in December' - were omitted, so it reported that no ship date exists.",
    lesson:
      "Optional parameters that silently drop data invite small models to suppress what they need. Prefer safe defaults, and say in the description when a field is omitted.",
  },
  {
    server: "filesystem",
    task: "top-region",
    score: "0/3 with tools",
    title: "Guessing a filename instead of looking",
    observed:
      "Asked about 'the Q3 revenue report', the model invented Q3_revenue_report.txt, tried to read it, searched for its own guess and gave up. It never called list_directory or directory_tree, although reports/q3.csv was one listing away.",
    lesson:
      "Agents need a nudge toward discovery. A description that says 'list the directory first when you do not know the exact path' is cheap to test - and this benchmark is how you would measure it.",
  },
  {
    server: "filesystem",
    task: "append-todo",
    score: "1/3 with tools",
    title: "Writing to paths that do not exist",
    observed:
      "One trial appended to an invented notes/todo.md; another used a made-up /project/... path that the server correctly refused. The passing trial first overwrote the whole file and then rebuilt it - correct in the end, destructive along the way.",
    lesson:
      "Outcome checks catch what transcripts hide: in the todo.md trial the agent confidently reported success. Destructive tools (write_file) next to safe ones (append_file) are a design risk for weaker models.",
  },
];
