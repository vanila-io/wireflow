import type { Metadata } from "next";
import Editor from "@/components/editor/flow-editor";

export const metadata: Metadata = {
  title: "Wireflow - Flow Editor",
};

export default function AppPage() {
  return <Editor />;
}
