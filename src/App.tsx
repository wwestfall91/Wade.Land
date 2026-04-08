import { useNavigate } from "react-router";
import "./App.scss";

function App() {
  let navigate = useNavigate();

  return (
    <div id="App">
      <div className="container">
        <p className="welcome-text">Welcome to my humble little corner of the internet!</p>
        <button className="enter-button" onClick={() => navigate("/Home") }>ENTER (Test)</button>
        <button className="whitney-button" onClick={() => navigate("/Whitney") }>WHITNEYS WONDERFUL LAND</button>
      </div>
    </div>
  );
}

export default App;
