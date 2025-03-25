import express from "express";
import helmet from "helmet";
import session from "express-session";
import dotenv from "dotenv";
import { handleLogin } from "./login.js";
import { handleSignup } from "./signup.js";
import db from "./db.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;

app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(session({
  secret: process.env.SESSION_SECRET, 
  resave: false, 
  saveUninitialized: true
}));
app.use(
   helmet.contentSecurityPolicy({
     directives: {
       defaultSrc: ["'self'"],
       fontSrc: ["'self'", "https://fonts.gstatic.com"],
       styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
       scriptSrc: ["'self'"]
     }
   })
 );
 app.use((req, res, next) => {
   res.setHeader("Content-Security-Policy", "script-src 'self' 'unsafe-inline' https://cdn.plot.ly;");
   next();
 });


let userProgress = {};
let surveyResults = {
   overall: [5],
   mental: [5],
   physical: [5],
   days: []
 };
let allResponses = [];

app.get("/", (req, res) => {
  res.redirect("/login");
});

app.get("/login", (req, res) => {
  res.render("login");
});
app.post("/login", handleLogin);
app.get("/logout", (req, res) => {
  userProgress = {}; 
  res.redirect("/login");
});

app.get("/signup", (req, res) => {
  res.render("signup");
});
app.post("/signup", handleSignup);

app.get("/home", (req, res) => {
  res.render("home");
});

app.get("/edit-account", async (req, res) => {
    if (!req.session.user) {
        return res.redirect("/login"); // Ensure user is logged in
    }

    try {
        const [user] = await db.query("SELECT * FROM users WHERE id = ?", [req.session.user.id]);

        if (!user) {
            return res.redirect("/home"); // Redirect if user not found
        }

        res.render("edit-account", { user: user[0], error: null }); // Always define error
    } catch (err) {
        console.error("Database error:", err);
        res.render("edit-account", { user: req.session.user, error: "Failed to load account details" });
    }
});

app.post("/edit-account", async (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const userId = req.session.user.id;
  const { full_name, email, age, gender, password } = req.body;

  try {
    let query = "UPDATE users SET full_name = ?, email = ?, age = ?, gender = ? WHERE id = ?";
    let params = [full_name, email, age || null, gender, userId];

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      query = "UPDATE users SET full_name = ?, email = ?, age = ?, gender = ?, password = ? WHERE id = ?";
      params = [full_name, email, age || null, gender, hashedPassword, userId];
    }

    await db.query(query, params);
    
    // Update session data
    req.session.user.full_name = full_name;
    req.session.user.email = email;
    req.session.user.age = age;
    req.session.user.gender = gender;

    res.redirect("/home");
  } catch (err) {
    console.error("Update Error:", err);
    res.status(500).send("Failed to update account details");
  }
});

app.get("/survey", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login"); // Redirect if the user is not logged in
  }

  const userId = req.session.user.id;
  const section = req.query.section || "general"; 
  res.render("survey", { userId, section });
});

app.get("/survey-choice", (req, res) => {
  res.render("survey-choice", { userProgress });
});

// **Updated /submit-survey route to store responses in MySQL**
app.post("/submit-survey", async (req, res) => {
  const { section, userId, ...responses } = req.body;
  userProgress[section] = true;

  let tableName;
  switch (section) {
    case "general":
      tableName = "general_survey";
      break;
    case "mental":
      tableName = "mental_survey";
      break;
    case "physical":
      tableName = "physical_survey";
      break;
    default:
      return res.status(400).json({ error: "Invalid survey section" });
  }

  try {
    const query = `INSERT INTO ${tableName} (user_id, response) VALUES (?, ?)`;
    await db.query(query, [userId, JSON.stringify(responses)]);

    if (userProgress.general && userProgress.mental && userProgress.physical) {
      return res.redirect("/survey?section=completed");
    }
    return res.redirect("/survey-choice");
  } catch (err) {
    console.error("Database Error:", err);
    return res.status(500).json({ error: "Failed to save survey response" });
  }
});

app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});
