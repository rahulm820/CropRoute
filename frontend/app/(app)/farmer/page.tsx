import type { Metadata } from "next";
import FarmerClient from "./FarmerClient";

export const metadata: Metadata = {
  title: "Farmer Console — CropRoute",
  description: "Post your mandi price report and see what buyers pay elsewhere.",
};

export default function FarmerPage() {
  return <FarmerClient />;
}
