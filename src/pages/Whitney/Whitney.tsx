function WhitneyPage() {
    return (
        <div id="WhitneyPage">
            <h1>Hello my name is Whitney!</h1>
            <div className="question">
                <div>My favorite color is: </div>
                <input type="text" placeholder="Purple"/>
            </div>
            <div className="question">
                <div>My favorite animal is: </div>
                <input type="text" placeholder="Baby Elephant"/>
            </div>
            <div className="question">
                <div>My favorite teacher is: </div>
                <input type="text" placeholder="Miss Hardy"/>
            </div>
            <div className="question">
                <div>My favorite food is: </div>
                <input type="text" />
            </div>
        </div>
      );
}

export default WhitneyPage;