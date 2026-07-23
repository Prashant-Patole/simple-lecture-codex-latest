import { Outlet } from "react-router-dom";
import { InstructorSidebar } from "./InstructorSidebar";
import { NoIndex } from "@/components/SEO";

export const InstructorLayout = () => {
  return (
    <div className="flex h-screen bg-background">
      <NoIndex />
      <InstructorSidebar />
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
};
