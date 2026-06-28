import React, { useState, useEffect } from "react";
import {
  Landmark, User, KeyRound, ArrowRight, UserCheck, CheckCircle2,
  Shield, Eye, EyeOff, UserPlus, LogIn, AlertCircle, Phone, Mail,
  Calendar, MapPin
} from "lucide-react";
import { UserSession } from "../types.ts";

interface LoginProps {
  onLogin: (session: UserSession) => void;
}

interface ApiDistrict {
  id: string;
  name: string;
  districtName: string;
  collectorName: string;
  mayorName: string;
  hasMayor: boolean;
}

interface ApiConstituency {
  id: string;
  name: string;
  constituencyName: string;
  districtId: string;
  mlaName: string;
  mlaParty: string;
}

interface CitizenRecord {
  name: string;
  username: string;
  age: string;
  phone: string;
  email: string;
  district: string;
  districtId: string;
  constituency: string;
  constituencyId: string;
  password: string;
}

const CITIZENS_KEY = "community_hero_citizens";

function loadCitizens(): CitizenRecord[] {
  try {
    return JSON.parse(localStorage.getItem(CITIZENS_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveCitizens(list: CitizenRecord[]) {
  localStorage.setItem(CITIZENS_KEY, JSON.stringify(list));
}

export default function Login({ onLogin }: LoginProps) {
  // page: "role" → pick role; "signin" → sign in form; "signup" → citizen register
  const [page, setPage] = useState<"role" | "signin" | "signup">("role");
  const [selectedRole, setSelectedRole] = useState<"citizen" | "collector" | "mla">("citizen");

  const [districts, setDistricts] = useState<ApiDistrict[]>([]);
  const [constituencies, setConstituencies] = useState<ApiConstituency[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Signin fields
  const [signInUsername, setSignInUsername] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [showSignInPwd, setShowSignInPwd] = useState(false);

  // Authority signin (collector/mla) — pick jurisdiction
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [selectedConstituency, setSelectedConstituency] = useState("");

  // Signup fields
  const [signupName, setSignupName] = useState("");
  const [signupUsername, setSignupUsername] = useState("");
  const [signupAge, setSignupAge] = useState("");
  const [signupPhone, setSignupPhone] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupDistrict, setSignupDistrict] = useState("");
  const [signupConstituency, setSignupConstituency] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirm, setSignupConfirm] = useState("");
  const [showSignupPwd, setShowSignupPwd] = useState(false);
  const [showSignupConfirm, setShowSignupConfirm] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Load districts & constituencies
  useEffect(() => {
    async function fetchData() {
      try {
        const [distRes, constRes] = await Promise.all([
          fetch("/api/districts").then((r) => r.json()),
          fetch("/api/constituencies").then((r) => r.json()),
        ]);
        if (distRes.success && Array.isArray(distRes.data)) setDistricts(distRes.data);
        if (constRes.success && Array.isArray(constRes.data)) setConstituencies(constRes.data);
      } catch {
        const fallbackDists: ApiDistrict[] = [
          { id: "chennai", name: "Chennai", districtName: "Chennai", collectorName: "Dr. J. Radhakrishnan, IAS", mayorName: "Tmt. R. Priya", hasMayor: true },
          { id: "coimbatore", name: "Coimbatore", districtName: "Coimbatore", collectorName: "Thiru. Kranthi Kumar Pati, IAS", mayorName: "Thiru. Kalpana Anandakumar", hasMayor: true },
          { id: "madurai", name: "Madurai", districtName: "Madurai", collectorName: "Tmt. M. S. Sangeetha, IAS", mayorName: "Thiru. Indrani Ponvasanth", hasMayor: true },
          { id: "salem", name: "Salem", districtName: "Salem", collectorName: "Thiru. S. Karmegam, IAS", mayorName: "", hasMayor: false },
        ];
        const fallbackConsts: ApiConstituency[] = [
          { id: "kolathur", name: "Kolathur", constituencyName: "Kolathur", districtId: "chennai", mlaName: "Thiru. M. K. Stalin", mlaParty: "DMK" },
          { id: "chepauk", name: "Chepauk-Thiruvallikeni", constituencyName: "Chepauk-Thiruvallikeni", districtId: "chennai", mlaName: "Thiru. Udhayanidhi Stalin", mlaParty: "DMK" },
          { id: "singanallur", name: "Singanallur", constituencyName: "Singanallur", districtId: "coimbatore", mlaName: "Thiru. K. R. Jayaram", mlaParty: "AIADMK" },
          { id: "madurai_central", name: "Madurai Central", constituencyName: "Madurai Central", districtId: "madurai", mlaName: "Thiru. Palanivel Thiagarajan", mlaParty: "DMK" },
        ];
        setDistricts(fallbackDists);
        setConstituencies(fallbackConsts);
      } finally {
        setLoadingData(false);
      }
    }
    fetchData();
  }, []);

  // Auto-set defaults when lists load
  useEffect(() => {
    if (districts.length > 0 && !selectedDistrict) setSelectedDistrict(districts[0].id);
    if (districts.length > 0 && !signupDistrict) setSignupDistrict(districts[0].id);
  }, [districts]);

  const filteredConstituencies = constituencies.filter(
    (c) => c.districtId.toLowerCase() === selectedDistrict.toLowerCase()
  );
  const signupFilteredConst = constituencies.filter(
    (c) => c.districtId.toLowerCase() === signupDistrict.toLowerCase()
  );

  useEffect(() => {
    if (filteredConstituencies.length > 0) setSelectedConstituency(filteredConstituencies[0].id);
    else setSelectedConstituency("");
  }, [selectedDistrict, constituencies]);

  useEffect(() => {
    if (signupFilteredConst.length > 0) setSignupConstituency(signupFilteredConst[0].id);
    else setSignupConstituency("");
  }, [signupDistrict, constituencies]);

  function clearError() { setError(null); setSuccessMsg(null); }

  // ── SIGN UP ──────────────────────────────────────────────────────────────
  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    // Validation
    if (!signupName.trim()) return setError("Full name is required.");
    if (!signupUsername.trim()) return setError("Username is required.");
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(signupUsername))
      return setError("Username must be 3-20 chars: letters, digits, underscore only.");
    if (!signupAge || isNaN(Number(signupAge)) || Number(signupAge) < 18 || Number(signupAge) > 120)
      return setError("Enter a valid age (18+).");
    if (!/^[6-9]\d{9}$/.test(signupPhone))
      return setError("Enter a valid 10-digit Indian mobile number.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signupEmail))
      return setError("Enter a valid email address.");
    if (!signupDistrict) return setError("Please select your district.");
    if (!signupConstituency) return setError("Please select your constituency.");
    if (signupPassword.length < 6) return setError("Password must be at least 6 characters.");
    if (signupPassword !== signupConfirm) return setError("Passwords do not match.");

    const citizens = loadCitizens();
    const usernameTaken = citizens.some(
      (c) => c.username.toLowerCase() === signupUsername.trim().toLowerCase()
    );
    if (usernameTaken) return setError("Username already taken. Please choose another.");

    const distObj = districts.find((d) => d.id === signupDistrict);
    const constObj = constituencies.find((c) => c.id === signupConstituency);

    const newCitizen: CitizenRecord = {
      name: signupName.trim(),
      username: signupUsername.trim().toLowerCase(),
      age: signupAge,
      phone: signupPhone,
      email: signupEmail.trim().toLowerCase(),
      district: distObj?.name || signupDistrict,
      districtId: signupDistrict,
      constituency: constObj?.name || signupConstituency,
      constituencyId: signupConstituency,
      password: signupPassword,
    };

    saveCitizens([...citizens, newCitizen]);
    setSuccessMsg("Account created! You can now sign in with your username and password.");
    // Clear form and go to signin
    setSignupName(""); setSignupUsername(""); setSignupAge("");
    setSignupPhone(""); setSignupEmail(""); setSignupPassword(""); setSignupConfirm("");
    setTimeout(() => {
      setSuccessMsg(null);
      setPage("signin");
    }, 2000);
  };

  // ── SIGN IN ───────────────────────────────────────────────────────────────
  const handleSignin = (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    if (selectedRole === "citizen") {
      // Citizen: username + password
      if (!signInUsername.trim()) return setError("Enter your username.");
      if (!signInPassword) return setError("Enter your password.");

      const citizens = loadCitizens();
      const identifier = signInUsername.trim().toLowerCase();
      const found = citizens.find(
        (c) =>
          (c.username === identifier ||
           c.email === identifier ||
           c.phone === identifier) &&
          c.password === signInPassword
      );
      if (!found) return setError("Invalid credentials. Check your username, email or phone and password.");

      onLogin({
        role: "citizen",
        name: found.name,
        email: found.email,
        district: found.district,
        constituency: found.constituency,
      });

    } else if (selectedRole === "collector") {
      // Collector: password = "c" + districtName (lowercase, no spaces)
      const distObj = districts.find((d) => d.id === selectedDistrict);
      const distName = (distObj?.name || selectedDistrict).toLowerCase().replace(/\s+/g, "");
      const expectedPassword = `c${distName}`;

      if (signInPassword !== expectedPassword) {
        return setError(`Incorrect password for collector of ${distObj?.name || selectedDistrict}.`);
      }

      onLogin({
        role: "collector",
        name: distObj?.collectorName || "District Collector",
        email: `collector.${selectedDistrict}@tn.gov.in`,
        assignedDistrict: distObj?.name || selectedDistrict,
      });

    } else if (selectedRole === "mla") {
      // MLA: password = "m" + constituencyName (lowercase, no spaces)
      const constObj = constituencies.find((c) => c.id === selectedConstituency);
      const constName = (constObj?.name || selectedConstituency).toLowerCase().replace(/\s+/g, "");
      const expectedPassword = `m${constName}`;

      if (signInPassword !== expectedPassword) {
        return setError(`Incorrect password for MLA of ${constObj?.name || selectedConstituency}.`);
      }

      const distObj = districts.find((d) => d.id === selectedDistrict);
      onLogin({
        role: "mla",
        name: constObj?.mlaName || "Legislative Member (MLA)",
        email: `mla.${selectedConstituency}@tn.gov.in`,
        assignedConstituency: constObj?.name || selectedConstituency,
        district: distObj?.name,
      });
    }
  };

  // ── SHARED STYLES ──────────────────────────────────────────────────────────
  const inputCls =
    "w-full px-4 py-3 border border-stone-200 focus:border-gov-maroon-700 focus:ring-0 outline-none text-gov-maroon-900 text-xs bg-white";
  const labelCls = "block text-[10px] font-black tracking-widest uppercase text-stone-400 mb-1";
  const selectCls =
    "w-full px-4 py-3 border border-stone-200 focus:border-gov-maroon-700 focus:ring-0 outline-none text-gov-maroon-900 text-xs uppercase bg-white font-bold tracking-wider";

  // ── ROLE PICKER PAGE ───────────────────────────────────────────────────────
  if (page === "role") {
    return (
      <div className="max-w-xl mx-auto my-12 bg-white border border-stone-200 p-8 shadow-sm space-y-8 animate-fadeIn rounded-sm">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-gov-gold-100 text-gov-maroon-800 text-[10px] font-bold tracking-widest uppercase rounded-full">
            <Shield size={12} /> Civic Grievance Authentication Gateway
          </div>
          <h2 className="font-display font-bold text-3xl tracking-tight text-gov-maroon-900">
            Community <span className="text-gov-gold-700 font-serif italic font-normal">Hero</span>
          </h2>
          <p className="text-xs text-stone-500 max-w-sm mx-auto">
            Select your role to continue to the civic grievance redressal platform.
          </p>
        </div>

        <div className="space-y-3">
          <label className={labelCls}>Choose your role</label>
          <div className="grid grid-cols-3 gap-3">
            {(["citizen", "collector", "mla"] as const).map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => {
                  setSelectedRole(role);
                  setPage("signin");
                  clearError();
                  setSignInUsername("");
                  setSignInPassword("");
                }}
                className="py-5 px-2 border border-stone-200 hover:border-gov-maroon-700 hover:bg-gov-gold-100 text-center flex flex-col items-center gap-2 cursor-pointer transition-all"
              >
                {role === "citizen" && <User size={22} className="text-gov-maroon-700" />}
                {role === "collector" && <Landmark size={22} className="text-gov-green-600" />}
                {role === "mla" && <UserCheck size={22} className="text-gov-gold-600" />}
                <span className="text-[10px] font-black uppercase tracking-wider text-gov-maroon-700">{role}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="pt-2 border-t border-gov-cream-200 text-center">
          <p className="text-[10px] text-stone-400 font-sans uppercase tracking-wider">
            New citizen?{" "}
            <button
              type="button"
              onClick={() => { setPage("signup"); clearError(); }}
              className="text-gov-maroon-700 underline cursor-pointer font-bold"
            >
              Create an account
            </button>
          </p>
        </div>
      </div>
    );
  }

  // ── SIGN UP PAGE ────────────────────────────────────────────────────────────
  if (page === "signup") {
    return (
      <div className="max-w-xl mx-auto my-8 bg-white border border-stone-200 p-8 shadow-sm space-y-6 animate-fadeIn">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-widest uppercase text-gov-maroon-800 bg-gov-gold-100 px-2.5 py-1 rounded-full">
              <UserPlus size={11} /> Citizen Registration
            </div>
            <h2 className="font-display font-black text-2xl uppercase tracking-tight text-gov-maroon-900">
              Create Account
            </h2>
          </div>
          <button
            type="button"
            onClick={() => { setPage("role"); clearError(); }}
            className="text-[10px] text-stone-400 underline font-sans uppercase cursor-pointer hover:text-gov-maroon-700"
          >
            ← Back
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 p-3 text-xs text-red-700">
            <AlertCircle size={14} className="shrink-0 mt-0.5" /> {error}
          </div>
        )}
        {successMsg && (
          <div className="flex items-start gap-2 bg-green-50 border border-green-200 p-3 text-xs text-gov-green-700">
            <CheckCircle2 size={14} className="shrink-0 mt-0.5" /> {successMsg}
          </div>
        )}

        <form onSubmit={handleSignup} className="space-y-4">
          {/* Name & Username */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}><User size={9} className="inline mr-1" />Full Name</label>
              <input type="text" value={signupName} onChange={(e) => { setSignupName(e.target.value); clearError(); }}
                placeholder="e.g. Kavin Kumar" className={inputCls} required />
            </div>
            <div>
              <label className={labelCls}>Username</label>
              <input type="text" value={signupUsername} onChange={(e) => { setSignupUsername(e.target.value); clearError(); }}
                placeholder="e.g. kavin_kumar" className={inputCls} required />
              <p className="text-[9px] text-stone-400 mt-1 font-sans">3-20 chars, letters/digits/underscore. Must be unique.</p>
            </div>
          </div>

          {/* Age & Phone */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}><Calendar size={9} className="inline mr-1" />Age</label>
              <input type="number" value={signupAge} onChange={(e) => { setSignupAge(e.target.value); clearError(); }}
                placeholder="e.g. 28" min={18} max={120} className={inputCls} required />
            </div>
            <div>
              <label className={labelCls}><Phone size={9} className="inline mr-1" />Phone Number</label>
              <input type="tel" value={signupPhone} onChange={(e) => { setSignupPhone(e.target.value); clearError(); }}
                placeholder="10-digit mobile" maxLength={10} className={inputCls} required />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className={labelCls}><Mail size={9} className="inline mr-1" />Email Address</label>
            <input type="email" value={signupEmail} onChange={(e) => { setSignupEmail(e.target.value); clearError(); }}
              placeholder="e.g. kavin@example.com" className={inputCls} required />
          </div>

          {/* District & Constituency */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}><MapPin size={9} className="inline mr-1" />District</label>
              <select value={signupDistrict} onChange={(e) => { setSignupDistrict(e.target.value); clearError(); }} className={selectCls} required>
                {districts.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Constituency</label>
              <select value={signupConstituency} onChange={(e) => { setSignupConstituency(e.target.value); clearError(); }} className={selectCls} required>
                {signupFilteredConst.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
                {signupFilteredConst.length === 0 && <option value="">No constituencies</option>}
              </select>
            </div>
          </div>

          {/* Password & Confirm */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}><KeyRound size={9} className="inline mr-1" />Set Password</label>
              <div className="relative">
                <input type={showSignupPwd ? "text" : "password"} value={signupPassword}
                  onChange={(e) => { setSignupPassword(e.target.value); clearError(); }}
                  placeholder="Min 6 characters" className={inputCls + " pr-10"} required />
                <button type="button" onClick={() => setShowSignupPwd(!showSignupPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-gov-maroon-700 cursor-pointer">
                  {showSignupPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            <div>
              <label className={labelCls}>Confirm Password</label>
              <div className="relative">
                <input type={showSignupConfirm ? "text" : "password"} value={signupConfirm}
                  onChange={(e) => { setSignupConfirm(e.target.value); clearError(); }}
                  placeholder="Re-enter password" className={inputCls + " pr-10"} required />
                <button type="button" onClick={() => setShowSignupConfirm(!showSignupConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-gov-maroon-700 cursor-pointer">
                  {showSignupConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
          </div>

          <button type="submit"
            className="w-full bg-gov-maroon-800 hover:bg-gov-maroon-900 text-white font-bold text-xs uppercase tracking-widest py-4 transition-colors flex items-center justify-center gap-2 cursor-pointer mt-2">
            <UserPlus size={14} /> Create Citizen Account
          </button>
        </form>

        <div className="pt-2 border-t border-gov-cream-200 text-center">
          <p className="text-[10px] text-stone-400 font-sans uppercase">
            Already have an account?{" "}
            <button type="button" onClick={() => { setPage("signin"); setSelectedRole("citizen"); clearError(); }}
              className="text-gov-maroon-700 underline cursor-pointer font-bold">Sign in</button>
          </p>
        </div>
      </div>
    );
  }

  // ── SIGN IN PAGE ────────────────────────────────────────────────────────────
  return (
    <div className="max-w-xl mx-auto my-12 bg-white border border-stone-200 p-8 shadow-sm space-y-6 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className={`inline-flex items-center gap-1.5 text-[10px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-full ${
            selectedRole === "citizen" ? "bg-gov-gold-100 text-gov-maroon-800" :
            selectedRole === "collector" ? "bg-green-50 text-gov-green-700" : "bg-gov-gold-100 text-gov-gold-700"
          }`}>
            {selectedRole === "citizen" && <><User size={11} /> Citizen Sign In</>}
            {selectedRole === "collector" && <><Landmark size={11} /> Collector Sign In</>}
            {selectedRole === "mla" && <><UserCheck size={11} /> MLA Sign In</>}
          </div>
          <h2 className="font-display font-black text-2xl uppercase tracking-tight text-gov-maroon-900">
            Welcome Back
          </h2>
        </div>
        <button type="button" onClick={() => { setPage("role"); clearError(); setSignInPassword(""); setSignInUsername(""); }}
          className="text-[10px] text-stone-400 underline font-sans uppercase cursor-pointer hover:text-gov-maroon-700">
          ← Back
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 p-3 text-xs text-red-700">
          <AlertCircle size={14} className="shrink-0 mt-0.5" /> {error}
        </div>
      )}

      <form onSubmit={handleSignin} className="space-y-4">

        {/* Citizen: username field */}
        {selectedRole === "citizen" && (
          <div>
            <label className={labelCls}>Username / Email / Phone</label>
            <input type="text" value={signInUsername} onChange={(e) => { setSignInUsername(e.target.value); clearError(); }}
              placeholder="Username, email or phone number" className={inputCls} autoComplete="username" required />
          </div>
        )}

        {/* Collector: district picker */}
        {selectedRole === "collector" && (
          <div>
            <label className={labelCls}>Your District</label>
            <select value={selectedDistrict} onChange={(e) => { setSelectedDistrict(e.target.value); clearError(); }} className={selectCls}>
              {districts.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <p className="text-[9px] text-stone-400 mt-1 font-sans">
              Password: <span className="text-stone-600 font-bold">c</span> + district name (e.g. <span className="text-stone-600 font-bold">cchennai</span>)
            </p>
          </div>
        )}

        {/* MLA: district → constituency picker */}
        {selectedRole === "mla" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>District</label>
              <select value={selectedDistrict} onChange={(e) => { setSelectedDistrict(e.target.value); clearError(); }} className={selectCls}>
                {districts.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Your Constituency</label>
              <select value={selectedConstituency} onChange={(e) => { setSelectedConstituency(e.target.value); clearError(); }} className={selectCls}>
                {filteredConstituencies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
                {filteredConstituencies.length === 0 && <option value="">No constituencies</option>}
              </select>
            </div>
            <div className="md:col-span-2">
              <p className="text-[9px] text-stone-400 font-sans">
                Password: <span className="text-stone-600 font-bold">m</span> + constituency name, no spaces (e.g. <span className="text-stone-600 font-bold">mkolathur</span>)
              </p>
            </div>
          </div>
        )}

        {/* Password field */}
        <div>
          <label className={labelCls}><KeyRound size={9} className="inline mr-1" />Password</label>
          <div className="relative">
            <input type={showSignInPwd ? "text" : "password"} value={signInPassword}
              onChange={(e) => { setSignInPassword(e.target.value); clearError(); }}
              placeholder="Enter password" className={inputCls + " pr-10"} autoComplete="current-password" required />
            <button type="button" onClick={() => setShowSignInPwd(!showSignInPwd)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-gov-maroon-700 cursor-pointer">
              {showSignInPwd ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>

        <button type="submit"
          className={`w-full text-white font-bold text-xs uppercase tracking-widest py-4 transition-colors flex items-center justify-center gap-2 cursor-pointer ${
            selectedRole === "citizen" ? "bg-gov-maroon-800 hover:bg-gov-maroon-900" :
            selectedRole === "collector" ? "bg-gov-green-700 hover:bg-gov-green-800" : "bg-gov-gold-600 hover:bg-gov-gold-700"
          }`}>
          <LogIn size={14} /> Sign In as {selectedRole.toUpperCase()}
          <ArrowRight size={14} />
        </button>
      </form>

      {selectedRole === "citizen" && (
        <div className="pt-2 border-t border-gov-cream-200 text-center">
          <p className="text-[10px] text-stone-400 font-sans uppercase">
            New citizen?{" "}
            <button type="button" onClick={() => { setPage("signup"); clearError(); }}
              className="text-gov-maroon-700 underline cursor-pointer font-bold">
              Create an account
            </button>
          </p>
        </div>
      )}

      <div className="pt-2 border-t border-gov-cream-200 text-[10px] text-stone-400 text-center font-sans uppercase tracking-wider flex items-center justify-center gap-1">
        <CheckCircle2 size={12} className="text-green-500" />
        <span>Tamil Nadu Civic Platform — Secure Portal</span>
      </div>
    </div>
  );
}
