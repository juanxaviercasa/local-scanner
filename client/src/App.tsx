import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Admin from "./pages/Admin";
import Home from "./pages/Home";
import NewProspecting from "./pages/NewProspecting";
import NotFound from "./pages/NotFound";
import ProspectDetail from "./pages/ProspectDetail";
import Prospects from "./pages/Prospects";
import RunDetail from "./pages/RunDetail";
import RunsHistory from "./pages/RunsHistory";
import ScannerDashboard from "./pages/ScannerDashboard";
import Settings from "./pages/Settings";
import Templates from "./pages/Templates";
import { Route, Switch } from "wouter";

function Router() { return <Switch><Route path="/" component={Home} /><Route path="/app" component={ScannerDashboard} /><Route path="/app/nueva-prospeccion" component={NewProspecting} /><Route path="/app/prospectos" component={Prospects} /><Route path="/app/prospectos/:id" component={ProspectDetail} /><Route path="/app/historial" component={RunsHistory} /><Route path="/app/historial/:id" component={RunDetail} /><Route path="/app/plantillas" component={Templates} /><Route path="/app/configuracion" component={Settings} /><Route path="/app/admin" component={Admin} /><Route component={NotFound} /></Switch>; }
export default function App() { return <ErrorBoundary><ThemeProvider defaultTheme="light"><TooltipProvider><Toaster /><Router /></TooltipProvider></ThemeProvider></ErrorBoundary>; }
