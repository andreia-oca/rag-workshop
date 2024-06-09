import { useState } from "react";
import { BackendService, UserDescription, Recommendation } from "@genezio-sdk/rag-workshop";
import "./App.css";

export default function App() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [response, setResponse] = useState<Recommendation[]>();
  const [loading, setLoading] = useState(false);

  async function askLlm(e: { preventDefault: () => void; }) {
    e.preventDefault();
    setLoading(true);
    const defaultName = "John Doe";
    const defaultDescription = "I am a full-stack developer passionate about open-source projects and generative AI.";
    const user: UserDescription = {
      name: name || defaultName,
      description: description || defaultDescription,
    };
    console.log(user);
    setResponse(await BackendService.ask(user));
    console.log(response);
    setLoading(false);
  }

  return (
    <>
      <div className="container">
        <h1>Personalized Speaker Recommendations</h1>
        <p className="subtitle">
          Complete the form below to get a list of speakers and talks from the <a href="https://c3fest.com" target="_blank" rel="noopener noreferrer">C3 Festival</a> tailored just for you:
        </p>
        <div className="card">
          <form onSubmit={askLlm}>
            <label htmlFor="name">Enter your name below:</label>
            <input
              type="text"
              id="name"
              className="input-box"
              onChange={(e) => setName(e.target.value)}
              placeholder="John Doe"
            />
            <br />
            <br />
            <label htmlFor="description">Enter your tech interest below:</label>
            <input
              type="text"
              id="description"
              className="input-box"
              onChange={(e) => setDescription(e.target.value)}
              placeholder="I am a full-stack developer passionate about open-source projects and generative AI."
            />
            <br />
            <br />
            <button type="submit" className="submit-button">Send</button>
          </form>
          {/* load a spinner */}
          {loading ? (
            <div className="spinner"></div>
          ) : (
            response && response.length > 0 && (
              <div className="response-list">
                {response.map((item, index) => (
                  <div key={index} className="response-item">
                    <h3>{item.speaker}</h3>
                    <p>{item.reason}</p>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>
      <footer className="footer">
        <a href="https://genezio.com" target="_blank" rel="noopener noreferrer" className="footer-link">
          <p>Built with Genezio with ❤️</p>
        </a>
      </footer>
    </>
  );
}
