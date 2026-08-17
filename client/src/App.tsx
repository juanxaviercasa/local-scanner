import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import DashboardLayout from "./components/DashboardLayout";
import { ThemeProvider } from "./contexts/ThemeContext";
import ActivityPage from "./pages/Activity";
import AdminPage from "./pages/Admin";
import DashboardPage from "./pages/Dashboard";
import FilesPage from "./pages/Files";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";
import ProfilePage from "./pages/Profile";
import ProjectsPage from "./pages/Projects";
import TasksPage from "./pages/Tasks";

function PrivatePage({ children }: { children: React.ReactNode }) { return <DashboardLayout>{children}</DashboardLayout>; }
function Router() { return <Switch>
  <Route path="/" component={Home} />
  <Route path="/app">{() => <PrivatePage><DashboardPage /></PrivatePage>}</Route>
  <Route path="/app/proyectos">{() => <PrivatePage><ProjectsPage /></PrivatePage>}</Route>
  <Route path="/app/tareas">{() => <PrivatePage><TasksPage /></PrivatePage>}</Route>
  <Route path="/app/archivos">{() => <PrivatePage><FilesPage /></PrivatePage>}</Route>
  <Route path="/app/actividad">{() => <PrivatePage><ActivityPage /></PrivatePage>}</Route>
  <Route path="/app/perfil">{() => <PrivatePage><ProfilePage /></PrivatePage>}</Route>
  <Route path="/app/admin">{() => <PrivatePage><AdminPage /></PrivatePage>}</Route>
  <Route path="/404" component={NotFound} /><Route component={NotFound} />
</Switch>; }
export default function App() { return <ErrorBoundary><ThemeProvider defaultTheme="light" switchable><TooltipProvider><Toaster richColors position="top-right" /><Router /></TooltipProvider></ThemeProvider></ErrorBoundary>; }

