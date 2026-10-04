import { BookOpen, BriefcaseBusiness, Flame, LogIn, LogOut, NotebookPen, UserRound } from "lucide-react";
import { useLocation } from "react-router-dom";

import { useAccount } from "@/components/AccountProvider";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const TABS = [
  { href: "/today", label: "Today", icon: Flame, testId: "nav-today-link" },
  { href: "/learn", label: "Learn", icon: BookOpen, testId: "nav-learn-link" },
  { href: "/discoveries", label: "Discoveries", icon: NotebookPen, testId: "nav-discoveries-link" },
  { href: "/portfolio", label: "Practice", icon: BriefcaseBusiness, testId: "nav-portfolio-link" },
] as const;

/** One uniform tab bar shared by every page: Today, Learn, Discoveries, Practice, then the account. */
export function HeaderNav() {
  const { account, requireSignIn, signOut } = useAccount();
  const { pathname } = useLocation();
  return <nav className="header-nav" aria-label="Main" data-testid="header-nav">
    <div className="header-tabs">
      {TABS.map(({ href, label, icon: Icon, testId }) => <a key={href} href={href} className={pathname.startsWith(href) ? "header-tab active" : "header-tab"} aria-current={pathname.startsWith(href) ? "page" : undefined} data-testid={testId}><Icon size={13} />{label}</a>)}
    </div>
    {account?.signed_in ? <DropdownMenu>
      <DropdownMenuTrigger className="header-account" data-testid="account-menu-trigger"><UserRound size={14} /><span className="hide-sm">{account.email}</span></DropdownMenuTrigger>
      <DropdownMenuContent align="end" data-testid="account-menu">
        <DropdownMenuItem disabled data-testid="account-email">{account.email}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => { window.location.href = "/portfolio"; }} data-testid="account-portfolios-link">My practice portfolios</DropdownMenuItem>
        <DropdownMenuItem onClick={() => { window.location.href = "/discoveries"; }} data-testid="account-discoveries-link">My Discoveries</DropdownMenuItem>
        <DropdownMenuItem onClick={signOut} data-testid="account-signout"><LogOut size={13} /> Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu> : <button type="button" className="header-signin" onClick={() => requireSignIn({ location: "header", heading: "Sign in to open your practice portfolios on any device" })} data-testid="nav-signin-button"><LogIn size={13} /> Sign in</button>}
  </nav>;
}
