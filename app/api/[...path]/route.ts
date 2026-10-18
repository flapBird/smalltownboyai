import { bindings } from "@/lib/env";
import { handle } from "@/lib/api";
export const dynamic = "force-dynamic";
export function GET(r: Request) {
  return handle(r, bindings());
}
export function POST(r: Request) {
  return handle(r, bindings());
}
export function DELETE(r: Request) {
  return handle(r, bindings());
}
