import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/auth";

// The auth instance is created lazily (after migrations), so resolve the handlers per request.
const handlers = async () => toNextJsHandler(await getAuth());

export async function GET(request: Request) {
  return (await handlers()).GET(request);
}

export async function POST(request: Request) {
  return (await handlers()).POST(request);
}
