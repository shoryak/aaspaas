import { BookOpen, LogIn, LogOut, UserRound } from "lucide-react";

import { useAccount } from "@/components/AccountProvider";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

/** Header links shared by every page: Learn, Today, and the account menu. */
export function HeaderNav() {
  const { account, requireSignIn, signOut } = useAccount();
  return <nav className="header-nav" data-testid="header-nav">
    <a href="/learn" className="header-nav-link" data-testid="nav-learn-link"><BookOpen size={13} /> Learn</a>
    <a href="/today" className="header-nav-link hide-sm" data-testid="nav-today-link">Today</a>
    {account?.signed_in ? <DropdownMenu>
      <DropdownMenuTrigger className="header-account" data-testid="account-menu-trigger"><UserRound size={14} /><span className="hide-sm">{account.email}</span></DropdownMenuTrigger>
      <DropdownMenuContent align="end" data-testid="account-menu">
        <DropdownMenuItem disabled data-testid="account-email">{account.email}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => { window.location.href = "/portfolio"; }} data-testid="account-portfolios-link">My practice portfolios</DropdownMenuItem>
        <DropdownMenuItem onClick={() => { window.location.href = "/discoveries"; }} data-testid="account-discoveries-link">My Discoveries</DropdownMenuItem>
        <DropdownMenuItem onClick={signOut} data-testid="account-signout"><LogOut size={13} /> Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu> : <button type="button" className="header-nav-link quiet" onClick={() => requireSignIn({ location: "header", heading: "Sign in to open your practice portfolios on any device", onDone: () => { window.location.href = "/portfolio"; } })} data-testid="nav-signin-button"><LogIn size={13} /> Sign in</button>}
  </nav>;
}
