import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import Home from "./pages/Home.tsx";

const router = createBrowserRouter([
  { path: "/", element: <App /> },
  { path: "/home", element: <Home />}
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <body>
    <RouterProvider router={router} />
  </body>
);
