import { Suspense } from "react";
import { MessagesContent } from "@/components/chat/messages-content";

export default function MensagensPage() {
  return (
    <Suspense>
      <MessagesContent />
    </Suspense>
  );
}
