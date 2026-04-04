import { useNavigate } from "react-router";
import "./App.css";

function App() {
  let navigate = useNavigate();

  return (
    <>
      <div className="container">
        <div className="welcome-text">You found me!</div>
        <button className="enter-button" onClick={() => navigate("/home")}>ENTER</button>
      </div>
    </>
  );
}

export default App;
