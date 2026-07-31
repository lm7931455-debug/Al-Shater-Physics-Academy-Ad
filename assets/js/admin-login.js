(() => {
  const { byId, request, toast } = window.PhysicsStudio;

  async function handleSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const errorNode = byId("login-error");
    const submitButton = form.querySelector('button[type="submit"]');

    errorNode.hidden = true;
    submitButton.disabled = true;

    try {
      await request("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          password: new FormData(form).get("password"),
        }),
      });
      toast("تم تسجيل الدخول بنجاح", "success");
      window.location.replace("/admin/");
    } catch (error) {
      errorNode.textContent = error.message || "الباسورد غير صحيح";
      errorNode.hidden = false;
    } finally {
      submitButton.disabled = false;
    }
  }

  window.addEventListener("DOMContentLoaded", () => {
    byId("login-form").addEventListener("submit", handleSubmit);
    request("/api/auth/me")
      .then(() => window.location.replace("/admin/"))
      .catch(() => {});
  });
})();
