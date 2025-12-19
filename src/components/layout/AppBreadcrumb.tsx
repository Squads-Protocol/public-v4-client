import { Home } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

const routeLabels: Record<string, string> = {
  '/': 'Dashboard',
  '/transactions': 'Transactions',
  '/config': 'Members',
  '/programs': 'Programs',
  '/settings': 'Settings',
  '/create': 'Create Squad',
};

export function AppBreadcrumb() {
  const location = useLocation();
  const pathname = location.pathname;

  // Clean up pathname (remove trailing slashes)
  const cleanPath = pathname.replace(/\/$/, '') || '/';

  // Get the current page label
  const currentLabel = routeLabels[cleanPath] || 'Page';

  // If we're on the home page, don't show breadcrumbs
  if (cleanPath === '/') {
    return null;
  }

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link to="/" className="flex items-center gap-1">
              <Home className="h-3.5 w-3.5" />
              <span className="sr-only sm:not-sr-only">Dashboard</span>
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>{currentLabel}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
