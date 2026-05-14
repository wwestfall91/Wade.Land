import { useNavigate } from "react-router";
import {useCookies } from "react-cookie"
import "./App.scss";
import { useEffect } from "react";

function App() {
  let navigate = useNavigate();
  const [cookies, setCookie, removeCookie] = useCookies(['user'])

  useEffect(() => {
    //setCookie("user", "Placeholder", {path: '/', maxAge: 604800 * 52})
  }, []);

  return (
    <div id="App">
      <div className="container">
        <p className="welcome-text">Welcome to my humble little corner of the internet!</p>
        <button className="enter-button" onClick={() => navigate("/Game") }>ENTER NOW</button>
      </div>
    </div>
  );
}

export default App;
