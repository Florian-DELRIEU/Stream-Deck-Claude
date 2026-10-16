// Inspecteur de l'action « Session » : diagnostic de la liaison avec Claude Code
// et boutons d'installation des hooks. La liste des sessions est gérée par <sdpi-select>.
(function () {
	const { streamDeckClient } = SDPIComponents;
	const $ = (id) => document.getElementById(id);
	let lastHook = null;

	function show(el, item) {
		el.textContent = item.text;
		el.dataset.ok = String(item.ok);
	}

	function ago(ms) {
		const s = Math.max(0, Math.round(ms / 1000));
		if (s < 60) return `il y a ${s} s`;
		const m = Math.round(s / 60);
		if (m < 60) return `il y a ${m} min`;
		return `il y a ${Math.round(m / 60)} h`;
	}

	function renderLast() {
		const el = $("cd-last");
		if (!lastHook) {
			el.textContent = "jamais — envoie un prompt dans Claude Code";
			el.dataset.ok = "false";
			return;
		}
		el.textContent = `${ago(Date.now() - lastHook.at)} — ${lastHook.event} — ${lastHook.project}`;
		el.dataset.ok = "true";
	}

	streamDeckClient.sendToPropertyInspector.subscribe((ev) => {
		const p = ev.payload;
		if (p?.event !== "status") return;
		show($("cd-server"), p.server);
		show($("cd-hooks"), p.hooks);
		$("cd-file").textContent = p.hooks.file ? `Fichier : ${p.hooks.file}` : "";
		lastHook = p.lastHook;
		renderLast();
		const result = $("cd-result");
		result.hidden = !p.result;
		if (p.result) {
			result.textContent = p.result.text;
			result.dataset.ok = String(p.result.ok);
		}
	});

	$("cd-install").addEventListener("click", () => streamDeckClient.send("sendToPlugin", { event: "install" }));
	$("cd-uninstall").addEventListener("click", () => streamDeckClient.send("sendToPlugin", { event: "uninstall" }));

	setInterval(renderLast, 1000);
	streamDeckClient.send("sendToPlugin", { event: "status" });
})();
