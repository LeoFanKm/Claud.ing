import { Outlet, useSearchParams } from "react-router-dom";
import { DevBanner } from "@/components/DevBanner";
import { Navbar } from "@/components/layout/Navbar";

export function NormalLayout() {
  const [searchParams] = useSearchParams();
  const view = searchParams.get("view");
  const shouldHideNavbar = view === "preview" || view === "diffs";

  return (
    <>
      <DevBanner />
      {!shouldHideNavbar && <Navbar />}
      <div className="min-h-0 flex-1 overflow-hidden">
        <Outlet />
      </div>
    </>
  );
}
