const crypto = require("node:crypto");
const { sendJson, methodNotAllowed, readBody } = require("./_lib/http");
const { selectRows, insertRow, updateRows } = require("./_lib/supabase");

function computeScore(selectedAnswer, correctAnswer) {
  return String(selectedAnswer || "").trim().toUpperCase() === String(correctAnswer || "").trim().toUpperCase() ? 100 : 0;
}

function extractClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    return String(forwarded).split(",")[0].trim();
  }
  return req.headers["x-real-ip"] || req.socket?.remoteAddress || "127.0.0.1";
}

function detectDevice(userAgent) {
  const ua = String(userAgent || "").toLowerCase();
  if (ua.includes("iphone")) return "iPhone";
  if (ua.includes("ipad")) return "iPad";
  if (ua.includes("android")) return "Android Mobile";
  if (ua.includes("windows")) return "Windows PC";
  if (ua.includes("macintosh")) return "Mac PC";
  if (ua.includes("linux")) return "Linux Device";
  return "Unknown Device";
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    methodNotAllowed(res, ["POST"]);
    return;
  }

  const body = await readBody(req);
  const examId = String(body.examId || "").trim();
  const selectedAnswer = String(body.selectedAnswer || "").trim().toUpperCase();
  const mobileNumber = String(body.student?.mobileNumber || "").trim();
  const fullName = String(body.student?.fullName || "").trim();
  const guardianNumber = String(body.student?.guardianNumber || "").trim();
  const school = String(body.student?.school || "").trim();

  // Use mobile number or name as primary student identifier
  const studentIdentifier = mobileNumber || fullName;

  if (!examId || !studentIdentifier) {
    sendJson(res, 400, { message: "بيانات الطالب والامتحان مطلوبة" });
    return;
  }

  // Get exam details
  const exams = await selectRows("exams", `select=*&id=eq.${encodeURIComponent(examId)}&limit=1`);
  const exam = exams[0];
  if (!exam) {
    sendJson(res, 404, { message: "الامتحان غير موجود" });
    return;
  }

  // Extract IP & User Agent for Spoofing Detector (رادار التلاعب)
  const currentIp = extractClientIp(req);
  const rawUserAgent = req.headers["user-agent"] || body.student?.userAgent || "";
  const currentDevice = detectDevice(rawUserAgent);

  // Search for existing student by mobile number or name
  let queryFilter = `mobile_number=eq.${encodeURIComponent(mobileNumber)}`;
  if (!mobileNumber) {
    queryFilter = `full_name=eq.${encodeURIComponent(fullName)}`;
  }

  const students = await selectRows("students", `select=*&${queryFilter}&limit=1`);
  const existing = students[0] || null;

  if (existing && existing.blocked) {
    sendJson(res, 403, { message: "عفواً، هذا الحساب محظور من أداء الامتحانات" });
    return;
  }

  // Spoofing Detector Logic (رادار التلاعب)
  let securityAlert = false;
  let securityAlertReason = "";
  let securityAlertAt = null;

  if (existing && existing.last_ip) {
    const isDifferentIp = existing.last_ip !== currentIp && currentIp !== "127.0.0.1";
    const isDifferentDevice = existing.last_device_type && existing.last_device_type !== currentDevice;
    
    // Calculate time since last exam submission (in hours)
    const lastExamTime = existing.last_exam_at ? new Date(existing.last_exam_at).getTime() : 0;
    const hoursSinceLast = (Date.now() - lastExamTime) / (1000 * 60 * 60);

    if ((isDifferentIp || isDifferentDevice) && hoursSinceLast < 48) {
      securityAlert = true;
      securityAlertReason = `إنذار أحمر: تم تقديم الامتحان من جهاز مختلف (${currentDevice} / ${currentIp}) عن الجهاز السابق (${existing.last_device_type || "جهاز آخر"} / ${existing.last_ip})`;
      securityAlertAt = new Date().toISOString();
    }
  }

  const chapters = await selectRows("chapters", `select=*&id=eq.${encodeURIComponent(exam.chapter_id)}&limit=1`);
  const chapter = chapters[0] || null;
  const score = computeScore(selectedAnswer, exam.correct_answer);

  const payload = {
    full_name: fullName || existing?.full_name || "طالب",
    student_number: mobileNumber || existing?.student_number || `ST-${Date.now()}`,
    mobile_number: mobileNumber,
    guardian_number: guardianNumber,
    school: school,
    grade: chapter?.grade || existing?.grade || "",
    score: score,
    blocked: false,
    last_exam_id: exam.id,
    last_exam_at: new Date().toISOString(),
    last_ip: currentIp,
    last_user_agent: rawUserAgent,
    last_device_type: currentDevice,
    security_alert: securityAlert || existing?.security_alert || false,
    security_alert_reason: securityAlert ? securityAlertReason : (existing?.security_alert_reason || ""),
    security_alert_at: securityAlert ? securityAlertAt : (existing?.security_alert_at || null),
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    await updateRows("students", [`id=eq.${encodeURIComponent(existing.id)}`], payload);
  } else {
    await insertRow("students", {
      id: crypto.randomUUID(),
      ...payload,
    });
  }

  sendJson(res, 200, {
    ok: true,
    score,
    passed: score >= 50,
  });
};
