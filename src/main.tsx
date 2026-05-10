import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { CookiesProvider } from "react-cookie";
import Home from "./pages/Home.tsx";
import Whitney from "./pages/Whitney/Whitney.tsx";
import Game from "./pages/Game/Game.tsx";
import Fight from "./pages/Fight/Fight.tsx";

const router = createBrowserRouter([
  { path: "/", element: <App /> },
  { path: "/home", element: <Home />},
  { path: "/game", element: <Game />},
  { path: "/whitney", element: <Whitney />},
  { path: "/fight", element: <Fight />}
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <CookiesProvider>
    <body>
      <RouterProvider router={router} />
    </body>
  </CookiesProvider>
);
