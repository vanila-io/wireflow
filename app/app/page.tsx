// /app route. Production: server page whose only child is the client component FlowEditor (module 98946),
// with document title "Wireflow - Flow Editor".
import type { Metadata } from 'next';
import FlowEditor from '@/components/FlowEditor';

export const metadata: Metadata = { title: 'Wireflow - Flow Editor' };

export default function AppPage() {
  return <FlowEditor />;
}
