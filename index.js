import express from "express";
import helmet from "helmet";
import session from "express-session";
import dotenv from "dotenv";
import { handleLogin } from "./login.js";
import { handleSignup } from "./signup.js";
import db from "./db.js";
import { adviceMap, questionMap } from "./advice.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;

app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(session({
  secret: process.env.SESSION_SECRET, 
  resave: false, 
  saveUninitialized: true,
  cookie: {
    secure: process.env.NODE_ENV === "production", 
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 // 1 day
  }
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

app.get("/home", async (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  // Get the current day of the week
  const today = new Date().getDay();
  // Hold the listed days of the week
  const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const userId = req.session.user.id;

  try {
    // Fetch survey results from the database
    const [general] = await db.query("SELECT * FROM general_survey WHERE user_id = ? ORDER BY created_at DESC", [userId]);
    const [mental] = await db.query("SELECT * FROM mental_survey WHERE user_id = ? ORDER BY created_at DESC", [userId]);
    const [physical] = await db.query("SELECT * FROM physical_survey WHERE user_id = ? ORDER BY created_at DESC", [userId]);

    // Helper function to initialize a week array
    function initializeWeekArray() {
      return new Array(7).fill(0);
    }

    // Function to calculate averages for the last 5 days
    function calculateRecentAverages(data) {
      const today = new Date();
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(today.getDate() - 6);

      const weekData = new Array(7).fill(null);
      const count = {};

      data.forEach(({ created_at, score }) => {
        const createdAtDate = new Date(created_at);
        if (createdAtDate >= sevenDaysAgo && createdAtDate <= today) {
          const dayIndex = (createdAtDate.getDay() + 7) % 7; // Normalize index
          weekData[dayIndex] = score;
        }
      });

      return weekData.map(score => score || 5);
    }

    // Convert survey results into weekly arrays, considering only the last 5 days
    const overallData = calculateRecentAverages(general);
    const mentalData = calculateRecentAverages(mental);
    const physicalData = calculateRecentAverages(physical);

    // Helper function to get the lowest feedback for each section
    function getLowestFeedback(data, sectionName) {
      const sectionQuestions = questionMap[sectionName];
      return data
        .map(entry => {
          const questionText = sectionQuestions[entry.question] || entry.question;
          return {
            question: questionText,
            avgScore: entry.score || 5,
          };
        })
        .sort((a, b) => a.avgScore - b.avgScore)
        .slice(0, 3)
        .map(({ question }) => ({
          question,
          advice: adviceMap[question] || "No advice available.",
        }));
    }

    // Render the home page with the filtered survey data
    res.render("home", {
      overallData,
      mentalData,
      physicalData,
      days: weekdays,
      overallFeedback: getLowestFeedback(general, "general"),
      mentalFeedback: getLowestFeedback(mental, "mental"),
      physicalFeedback: getLowestFeedback(physical, "physical"),
    });
  } catch (err) {
    console.error("Database error:", err);
    res.status(500).send("Failed to load survey results");
  }
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
    const query = `INSERT INTO ${tableName} (user_id, question, score) VALUES (?, ?, ?)`;
    for (const [question, score] of Object.entries(responses)) {
      await db.query(query, [userId, question, parseInt(score)]);
    }
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
