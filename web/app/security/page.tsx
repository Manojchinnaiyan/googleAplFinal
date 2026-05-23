import { SecurityListener } from "@/components/SecurityListener";

export const metadata = {
  title: "StadiumOS — Security Listening Post",
  description: "Audio-first ops view for security and ticketing teams.",
};

export default function SecurityPage() {
  return <SecurityListener />;
}
