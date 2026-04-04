import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import Home from "./pages/Home.tsx";
import Whitney from "./pages/Whitney/Whitney.tsx";

const router = createBrowserRouter([
  { path: "/", element: <App /> },
  { path: "/home", element: <Home />},
  { path:"/whitney", element: <Whitney />}
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <body>
    <RouterProvider router={router} />
  </body>
);
