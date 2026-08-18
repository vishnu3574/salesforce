import React, { useState, useEffect, useCallback } from "react";

const CLIENT_ID = "...."
const REDIRECT_URI = "..."
const AUTH_URL = "...."
const TOKEN_URL = "...."
const API_VERSION = "v61.0"
const PROXY_URL = "...." 

const OBJECTS = {
  Account: { fields: "Id, Name, Industry, Phone", columns: ["Name", "Industry", "Phone"], createFields: ["Name", "Industry", "Phone"] },
  Contact: { fields: "Id, Name, Email, Phone, Account.Name", columns: ["Name", "Email", "Phone", "Account"], createFields: ["FirstName", "LastName", "Email", "Phone"] },
  Lead: { fields: "Id, Name, Company, Status, Phone, Email, CreatedDate", columns: ["Name", "Company", "Status", "Phone"], createFields: ["FirstName", "LastName", "Company", "Phone", "Status"] },
  Opportunity: { fields: "Id, Name, StageName, Amount, CloseDate, Account.Name", columns: ["Name", "Stage", "Amount", "Close Date", "Account"], createFields: ["Name", "StageName", "Amount", "CloseDate"] },
  Case: { fields: "Id, CaseNumber, Subject, Status, Priority, Account.Name", columns: ["Case #", "Subject", "Status", "Priority", "Account"], createFields: ["Subject", "Status", "Priority"] }
}

function base64url(buffer) { return btoa(String.fromCharCode(...new Uint8Array(buffer))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, ""); }
function generateRandomString(length) { const array = new Uint8Array(length); crypto.getRandomValues(array); return base64url(array); }
async function generatePKCE() { const codeVerifier = generateRandomString(32); const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(codeVerifier)); const codeChallenge = base64url(digest); return { codeVerifier, codeChallenge }; }

export default function App() {
  const [token, setToken] = useState(localStorage.getItem("sf_token"));
  const [instance, setInstance] = useState(localStorage.getItem("sf_instance"));
  const [error, setError] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState(localStorage.getItem("sf_username"));
  const [selectedObject, setSelectedObject] = useState("Lead");
  const [page, setPage] = useState(1);
  const [totalSize, setTotalSize] = useState(0);
  const [editing, setEditing] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [viewRecord, setViewRecord] = useState(null);
  const [newRecord, setNewRecord] = useState({});

  const pageSize = 20;
  const totalPages = Math.ceil(totalSize / pageSize);

  const fetchRecords = useCallback(async (objName, newPage = 1) => {
    if (!token ||!instance) return;
    setLoading(true); setError(null);
    try {
      const config = OBJECTS[objName];
      const newOffset = (newPage - 1) * pageSize;

      const countSoql = `SELECT COUNT() FROM ${objName}`;
      const countUrl = `${PROXY_URL}${encodeURIComponent(instance + `/services/data/${API_VERSION}/query/?q=${encodeURIComponent(countSoql)}`)}`;
      const countRes = await fetch(countUrl, { headers: { Authorization: `Bearer ${token}` } });
      const countData = await countRes.json();
      setTotalSize(countData.totalSize || 0);

      const soql = `SELECT ${config.fields} FROM ${objName} ORDER BY CreatedDate DESC LIMIT ${pageSize} OFFSET ${newOffset}`;
      const apiUrl = `${PROXY_URL}${encodeURIComponent(instance + `/services/data/${API_VERSION}/query/?q=${encodeURIComponent(soql)}`)}`;

      const res = await fetch(apiUrl, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data[0]?.message || "Failed to load");

      setRecords(data.records);
      setPage(newPage);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [token, instance]);

  const fetchUserInfo = useCallback(async () => {
    if (!token ||!instance) return;
    const identityUrl = `${PROXY_URL}${encodeURIComponent(instance + `/services/oauth2/userinfo`)}`;
    const res = await fetch(identityUrl, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (data.email) { setUsername(data.email); localStorage.setItem("sf_username", data.email); }
  }, [token, instance]);

  useEffect(() => {
    if (token && instance) {
      fetchRecords(selectedObject, 1);
      fetchUserInfo();
    }
  }, [token, instance, selectedObject, fetchRecords, fetchUserInfo]);

  const createRecord = async () => {
    if(selectedObject === "Lead" && (!newRecord.LastName ||!newRecord.Company)) { alert("LastName and Company are required for Lead"); return; }
    setLoading(true); setError(null);
    try {
      const apiUrl = `${PROXY_URL}${encodeURIComponent(instance + `/services/data/${API_VERSION}/sobjects/${selectedObject}/`)}`;
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(newRecord)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data[0]?.message || JSON.stringify(data));

      alert(`${selectedObject} Created Successfully! ID: ${data.id}`);
      setShowAdd(false); setNewRecord({});
      fetchRecords(selectedObject, 1);
    } catch (err) { alert("Error: " + err.message); setError(err.message); }
    finally { setLoading(false); }
  }

  const deleteRecord = async (id) => {
    if (!window.confirm("Delete this record?")) return;
    const apiUrl = `${PROXY_URL}${encodeURIComponent(instance + `/services/data/${API_VERSION}/sobjects/${selectedObject}/${id}`)}`;
    await fetch(apiUrl, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    fetchRecords(selectedObject, page);
  }

  const updateRecord = async (id, fields) => {
    const apiUrl = `${PROXY_URL}${encodeURIComponent(instance + `/services/data/${API_VERSION}/sobjects/${selectedObject}/${id}`)}`;
    await fetch(apiUrl, { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(fields) });
    setEditing(null);
    fetchRecords(selectedObject, page);
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const verifier = localStorage.getItem("pkce_verifier");
    if (code && verifier) {
      fetch(`${PROXY_URL}${encodeURIComponent(TOKEN_URL)}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "authorization_code", client_id: CLIENT_ID, code, redirect_uri: REDIRECT_URI, code_verifier: verifier })
      })
.then(res => res.json())
.then(d => {
        if (d.access_token) {
          localStorage.setItem("sf_token", d.access_token);
          localStorage.setItem("sf_instance", d.instance_url);
          setToken(d.access_token);
          setInstance(d.instance_url);
          localStorage.removeItem("pkce_verifier");
          window.history.replaceState({}, "", "/");
        } else setError(d.error_description);
      });
    }
  }, []);

  const login = async () => {
    const { codeVerifier, codeChallenge } = await generatePKCE();
    localStorage.setItem("pkce_verifier", codeVerifier);
    window.location.href = `${AUTH_URL}?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&code_challenge=${codeChallenge}&code_challenge_method=S256`;
  }
  const logout = () => { localStorage.clear(); setToken(null); setInstance(null); setRecords([]); }

  if (!token) return (
    <div style={{padding: 40, textAlign: "center", background: "#f4f6f9", minHeight: "100vh"}}>
      <h2>Salesforce CRM Assessment</h2>
      {error && <p style={{color: "red"}}>{error}</p>}
      <button onClick={login} style={{padding: "12px 24px", background: "#0176d3", color: "white", border: "none", borderRadius: 4, fontSize: 16}}>Login with Salesforce</button>
    </div>
  );

  return (
    <div style={{padding: 20, background: "#f4f6f9", minHeight: "100vh"}}>
      <div style={{display: "flex", justifyContent: "space-between", marginBottom: 20}}>
        <h1>Salesforce CRM</h1>
        <div><b>{username}</b> <button onClick={logout} style={{marginLeft: 10, padding: "8px 16px", background: "#C23934", color: "white", border: "none", borderRadius: 4}}>Logout</button></div>
      </div>

      <div style={{display: "flex", justifyContent: "space-between", marginBottom: 20}}>
        <select value={selectedObject} onChange={e => setSelectedObject(e.target.value)} style={{padding: 10, fontSize: 16}}>
          {Object.keys(OBJECTS).map(obj => <option key={obj} value={obj}>{obj}</option>)}
        </select>
        <button onClick={() => setShowAdd(true)} style={{padding: "10px 20px", background: "#2E844A", color: "white", border: "none", borderRadius: 4}}>
          + Add New {selectedObject}
        </button>
      </div>

      {error && <p style={{color: "red", background: "white", padding: 10}}>Error: {error}</p>}

      {viewRecord && (
        <div style={{position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000}}>
          <div style={{background: "white", padding: 20, borderRadius: 8, width: 500}}>
            <h3>View {selectedObject}: {viewRecord.Name || viewRecord.Subject}</h3>
            {Object.keys(viewRecord).filter(k => k!== "attributes" && k!== "Id").map(key => (
              <p key={key}><b>{key}:</b> {viewRecord[key]?.Name || viewRecord[key] || "-"}</p>
            ))}
            <button onClick={() => setViewRecord(null)}>Close</button>
          </div>
        </div>
      )}

      {showAdd && (
        <div style={{position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000}}>
          <div style={{background: "white", padding: 20, borderRadius: 8, width: 400}}>
            <h3>Add New {selectedObject}</h3>
            {OBJECTS[selectedObject].createFields.map(field => (
              <div key={field} style={{marginBottom: 10}}>
                <label>{field} {field === "LastName" || field === "Company"? "*" : ""}</label>
                <input type="text" style={{width: "100%", padding: 8, marginTop: 5}} onChange={e => setNewRecord({...newRecord, [field]: e.target.value})} />
              </div>
            ))}
            <button onClick={createRecord} disabled={loading} style={{padding: "8px 16px", background: "#0176d3", color: "white", border: "none"}}>{loading? "Saving..." : "Save"}</button>
            <button onClick={() => setShowAdd(false)} style={{marginLeft: 10}}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{background: "white", borderRadius: 8}}>
        <p style={{padding: 12}}>Total: {totalSize} {selectedObject}s</p>
        <table style={{width: "100%", borderCollapse: "collapse"}}>
          <thead><tr style={{background: "#0176d3", color: "white"}}>
            {OBJECTS[selectedObject].columns.map(c => <th key={c} style={{padding: 12, textAlign: "left"}}>{c}</th>)}
            <th style={{padding: 12, textAlign: "left"}}>Actions</th>
          </tr></thead>
          <tbody>
            {records.map(rec => (
              <tr key={rec.Id} style={{borderBottom: "1px solid #ddd"}}>
                {editing === rec.Id? (
                  <EditRow rec={rec} onSave={updateRecord} onCancel={() => setEditing(null)} colSpan={OBJECTS[selectedObject].columns.length + 1} />
                ) : (
                  <>
                    {OBJECTS[selectedObject].columns.map(col => {
                      let val = col === "Account"? rec.Account?.Name : rec[col] || rec[col.replace(" ", "")];
                      if (col === "Amount" && val) val = `$${val}`;
                      return <td key={col} style={{padding: 12}}>{val || "-"}</td>
                    })}
                    <td style={{padding: 12}}>
                      <button onClick={() => setViewRecord(rec)}>View</button>
                      <button onClick={() => setEditing(rec.Id)} style={{marginLeft: 5}}>Edit</button>
                      <button onClick={() => deleteRecord(rec.Id)} style={{marginLeft: 5, color: "red"}}>Delete</button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {loading && <p style={{textAlign: "center", padding: 15}}>Loading...</p>}

        {/* PAGINATION BUTTONS */}
        <div style={{padding: 15, display: "flex", justifyContent: "center", alignItems: "center", gap: 10, borderTop: "1px solid #ddd"}}>
          <button 
            disabled={page === 1} 
            onClick={() => fetchRecords(selectedObject, page - 1)} 
            style={{padding: "8px 16px", cursor: page === 1? "not-allowed" : "pointer", opacity: page === 1? 0.5 : 1}}
          >
            Previous
          </button>
          <span>Page {page} of {totalPages || 1}</span>
          <button 
            disabled={page === totalPages || totalPages === 0} 
            onClick={() => fetchRecords(selectedObject, page + 1)} 
            style={{padding: "8px 16px", cursor: page === totalPages? "not-allowed" : "pointer", opacity: page === totalPages? 0.5 : 1}}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

function EditRow({rec, onSave, onCancel, colSpan}) {
  const [val, setVal] = useState(rec.Name || rec.Subject || rec.CaseNumber || "");
  const field = rec.Name? "Name" : rec.Subject? "Subject" : "CaseNumber";
  return (
    <td colSpan={colSpan}>
      <input value={val} onChange={e => setVal(e.target.value)} style={{padding: 5}} />
      <button onClick={() => onSave(rec.Id, {[field]: val})} style={{marginLeft: 10}}>Save</button>
      <button onClick={onCancel} style={{marginLeft: 5}}>Cancel</button>
    </td>
  )
}