"use client";

import { useEffect, useMemo, useRef, useState } from "react";

function useVoices() {
  const [voices, setVoices] = useState([]);
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const update = () => setVoices(window.speechSynthesis.getVoices());
    update();
    window.speechSynthesis.onvoiceschanged = update;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);
  return voices;
}

function createDefaultAgent(index, voices) {
  const preferred = voices.find(v => (v.lang || "").toLowerCase().startsWith("en"));
  const first = voices[0];
  return {
    id: crypto.randomUUID(),
    name: `Agent ${index + 1}`,
    voiceUri: (preferred || first)?.voiceURI || "",
    rate: 1,
    pitch: 1,
    volume: 1,
    text: "",
  };
}

export default function Page() {
  const voices = useVoices();
  const [agents, setAgents] = useState([]);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Load from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem("tts_agents");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setAgents(parsed);
      } else {
        // seed with two agents if voices available
        if (voices.length) {
          setAgents([createDefaultAgent(0, voices), createDefaultAgent(1, voices)]);
        }
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voices.length]);

  // Persist to localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try { localStorage.setItem("tts_agents", JSON.stringify(agents)); } catch {}
  }, [agents]);

  const voiceOptions = useMemo(() => (
    voices.map(v => ({
      value: v.voiceURI,
      label: `${v.name}${v.lang ? ` (${v.lang})` : ""}${v.default ? " ? default" : ""}`,
    }))
  ), [voices]);

  const getVoiceByUri = (uri) => voices.find(v => v.voiceURI === uri);

  const speakUtterance = (agent, text) => {
    if (!text || !text.trim()) return null;
    const utter = new SpeechSynthesisUtterance(text);
    const voice = getVoiceByUri(agent.voiceUri);
    if (voice) utter.voice = voice;
    utter.rate = agent.rate;
    utter.pitch = agent.pitch;
    utter.volume = agent.volume;
    return utter;
  };

  const speakAgent = (agent) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const utter = speakUtterance(agent, agent.text);
    if (!utter) return;
    setIsSpeaking(true);
    utter.onend = () => setIsSpeaking(false);
    utter.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.cancel(); // reset queue
    window.speechSynthesis.speak(utter);
  };

  const speakAll = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const queue = agents.map(a => speakUtterance(a, a.text)).filter(Boolean);
    if (!queue.length) return;
    let idx = 0;
    setIsSpeaking(true);
    const next = () => {
      const current = queue[idx++];
      if (!current) {
        setIsSpeaking(false);
        return;
      }
      current.onend = next;
      current.onerror = next;
      window.speechSynthesis.speak(current);
    };
    window.speechSynthesis.cancel();
    next();
  };

  const stopSpeaking = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  const addAgent = () => {
    setAgents(prev => {
      const nextIdx = prev.length;
      return [...prev, createDefaultAgent(nextIdx, voices)];
    });
  };

  const removeAgent = (id) => {
    setAgents(prev => prev.filter(a => a.id !== id));
  };

  const updateAgent = (id, patch) => {
    setAgents(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a));
  };

  const voicesMissing = typeof window !== 'undefined' && !('speechSynthesis' in window);

  return (
    <div className="container">
      <div className="header">
        <div className="title">Text-to-Speech Agents</div>
        <span className="badge">
          {voicesMissing ? 'Browser not supported' : `${voices.length} voices available`}
        </span>
      </div>

      {!voicesMissing && voices.length === 0 && (
        <div className="warn" style={{ marginBottom: 12 }}>
          Loading voices? If nothing appears, interact with the page or try Chrome.
        </div>
      )}

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <div className="sectionTitle">Agents</div>
            <div className="small">Add characters, pick distinct voices, then type lines.</div>
          </div>
          <div className="row" style={{ width: 'auto' }}>
            <button className="button" onClick={addAgent} disabled={!voices.length}>Add agent</button>
            <button className="button secondary" onClick={() => setAgents([])}>Clear all</button>
          </div>
        </div>
      </div>

      <div className="grid">
        {agents.map((agent, i) => (
          <div className="card" key={agent.id}>
            <div className="row" style={{ alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <label className="label">Name</label>
                <input
                  className="input"
                  value={agent.name}
                  onChange={(e) => updateAgent(agent.id, { name: e.target.value })}
                  placeholder={`Agent ${i + 1}`}
                />
              </div>
              <div style={{ width: 160, textAlign: 'right' }}>
                <button className="button danger" onClick={() => removeAgent(agent.id)}>Delete</button>
              </div>
            </div>

            <div className="row" style={{ marginTop: 10 }}>
              <div>
                <label className="label">Voice</label>
                <select
                  className="select"
                  value={agent.voiceUri}
                  onChange={(e) => updateAgent(agent.id, { voiceUri: e.target.value })}
                >
                  {voiceOptions.map(v => (
                    <option key={v.value} value={v.value}>{v.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Rate: {agent.rate.toFixed(2)}</label>
                <input
                  className="slider"
                  type="range" min={0.5} max={2} step={0.05}
                  value={agent.rate}
                  onChange={(e) => updateAgent(agent.id, { rate: parseFloat(e.target.value) })}
                />
              </div>
              <div>
                <label className="label">Pitch: {agent.pitch.toFixed(2)}</label>
                <input
                  className="slider"
                  type="range" min={0} max={2} step={0.05}
                  value={agent.pitch}
                  onChange={(e) => updateAgent(agent.id, { pitch: parseFloat(e.target.value) })}
                />
              </div>
              <div>
                <label className="label">Volume: {agent.volume.toFixed(2)}</label>
                <input
                  className="slider"
                  type="range" min={0} max={1} step={0.05}
                  value={agent.volume}
                  onChange={(e) => updateAgent(agent.id, { volume: parseFloat(e.target.value) })}
                />
              </div>
            </div>

            <div style={{ marginTop: 10 }}>
              <label className="label">Line</label>
              <textarea
                className="textarea"
                value={agent.text}
                onChange={(e) => updateAgent(agent.id, { text: e.target.value })}
                placeholder={`What should ${agent.name} say?`}
              />
            </div>

            <div className="footer">
              <button className="button" onClick={() => speakAgent(agent)} disabled={!agent.text.trim() || !voices.length}>Speak</button>
              <button className="button secondary" onClick={stopSpeaking} disabled={!isSpeaking}>Stop</button>
            </div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="sectionTitle">Playback</div>
            <div className="small">Speak all agents in order using their settings.</div>
          </div>
          <div className="row" style={{ width: 'auto' }}>
            <button className="button" onClick={speakAll} disabled={!agents.some(a => a.text.trim()) || !voices.length}>Speak all</button>
            <button className="button secondary" onClick={stopSpeaking} disabled={!isSpeaking}>Stop</button>
          </div>
        </div>
      </div>

      {!voicesMissing && (
        <div className="subtle" style={{ marginTop: 12 }}>
          Tip: On some browsers, you may need to interact with the page before voices load.
        </div>
      )}

      {voicesMissing && (
        <div className="card warn" style={{ marginTop: 12 }}>
          Your browser does not support the Web Speech API's speechSynthesis. Try Chrome or Edge.
        </div>
      )}
    </div>
  );
}
