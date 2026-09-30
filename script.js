// script.js
// Application calendrier avec gestion des notes en localStorage
// Fonctions principales : renderCalendar, selectDate, openNoteModal, saveNote, editNote, deleteNote, renderNotes, loadNotes

// ----- Utilitaires -----

/** Retourne YYYY-MM-DD pour une Date donnée (évite les problèmes de fuseau) */
function toISODateLocal(d) {
	const yyyy = d.getFullYear();
	const mm = String(d.getMonth() + 1).padStart(2, '0');
	const dd = String(d.getDate()).padStart(2, '0');
	return `${yyyy}-${mm}-${dd}`;
}

/** Echappe le texte pour éviter l'injection HTML */
function escapeHTML(str = '') {
	return String(str)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}

/** Génère un id unique simple */
function uid() {
	return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** Affiche un toast temporaire */
function showToast(message, timeout = 2200) {
	const t = document.getElementById('toast');
	t.textContent = message;
	t.style.opacity = '1';
	t.style.transform = 'translateY(0)';
	clearTimeout(t._hide);
	t._hide = setTimeout(() => {
		t.style.opacity = '0';
		t.style.transform = 'translateY(12px)';
	}, timeout);
}

// ----- Stockage -----
const STORAGE_KEY = 'calendarNotes';

/** Charge les notes depuis localStorage (retourne objet : date => [notes]) */
function loadNotes() {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return {};
		const parsed = JSON.parse(raw);
		return parsed || {};
	} catch (e) {
		console.warn('Erreur en lisant localStorage', e);
		return {};
	}
}

/** Sauvegarde l'objet notes complet dans localStorage */
function saveNotesStorage(obj) {
	localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
}

// ----- Etat de l'app -----
let notes = loadNotes(); // objet maps dates -> array de notes
let current = new Date(); // première vue du mois (utiliser getFullYear/getMonth)
let selectedDate = null; // YYYY-MM-DD

// Elements DOM
const calendarGrid = document.getElementById('calendarGrid');
const monthYear = document.getElementById('monthYear');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const todayBtn = document.getElementById('todayBtn');
const selectedDateHeading = document.getElementById('selectedDateHeading');
const notesList = document.getElementById('notesList');
const addNoteBtn = document.getElementById('addNoteBtn');
const clearDataBtn = document.getElementById('clearDataBtn');
const filterAllBtn = document.getElementById('filterAllBtn');
const filterUnvalidatedBtn = document.getElementById('filterUnvalidatedBtn');

let showOnlyUnvalidated = false;

// Modal elements
const modal = document.getElementById('modal');
const modalBackdrop = document.getElementById('modalBackdrop');
const closeModalBtn = document.getElementById('closeModal');
const noteForm = document.getElementById('noteForm');
const noteIdInput = document.getElementById('noteId');
const noteDateInput = document.getElementById('noteDate');
const noteTitleInput = document.getElementById('noteTitle');
const noteTimeInput = document.getElementById('noteTime');
const noteColorInput = document.getElementById('noteColor');
const noteDescInput = document.getElementById('noteDesc');
const cancelBtn = document.getElementById('cancelBtn');
const titleError = document.getElementById('titleError');

// ----- Rendu du calendrier -----

/** Rend la grille du calendrier en partant du premier jour de `current` (lundi comme premier jour) */
function renderCalendar() {
	// créer une date représentant le premier jour du mois courant
	const year = current.getFullYear();
	const month = current.getMonth();
	// premier jour du mois
	const firstOfMonth = new Date(year, month, 1);
	// quel jour de la semaine? (0=Dimanche,1=Lundi,...)
	// Nous voulons une semaine commençant par Lundi.
	let firstWeekDay = firstOfMonth.getDay(); // 0..6 (Sun..Sat)
	// Convertir pour que Lundi=0..Dimanche=6
	firstWeekDay = (firstWeekDay + 6) % 7;

	// nombre de jours dans le mois
	const daysInMonth = new Date(year, month + 1, 0).getDate();
	// nombre de jours du mois précédent visibles
	const prevDays = firstWeekDay;
	// total de cellules (arrondir à 7)
	const totalCells = Math.ceil((prevDays + daysInMonth) / 7) * 7;

	// jour à afficher dans la première cellule
	const startDate = new Date(year, month, 1 - prevDays);

	// titre mois + année
	const localeMonth = startDate.toLocaleString('fr-FR', { month: 'long' });
	monthYear.textContent = `${current.toLocaleString('fr-FR', { month: 'long' }).charAt(0).toUpperCase() + current.toLocaleString('fr-FR', { month: 'long' }).slice(1)} ${year}`;

	// jour d'aujourd'hui pour mise en évidence
	const todayStr = toISODateLocal(new Date());

	// construire grille HTML
	calendarGrid.innerHTML = '';
	for (let i = 0; i < totalCells; i++) {
		const d = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + i);
		const dayStr = toISODateLocal(d);
		const isOutside = d.getMonth() !== month;
		const cell = document.createElement('button');
		cell.className = 'day' + (isOutside ? ' outside' : '');
		cell.setAttribute('data-date', dayStr);
		cell.setAttribute('type', 'button');
		cell.innerHTML = `<div class="date-number">${d.getDate()}</div><div class="indicators"></div>`;
		if (dayStr === todayStr) {
			cell.classList.add('today');
		}
		if (selectedDate === dayStr) {
			cell.classList.add('selected');
		}
		if (!isOutside) {
			cell.addEventListener('click', () => selectDate(dayStr));
		} else {
			// Permettre tout de même de sélectionner un jour hors mois (change le mois)
			cell.addEventListener('click', () => {
				// si jour appartient au mois précédent ou suivant, naviguer puis sélectionner
				current = new Date(d.getFullYear(), d.getMonth(), 1);
				renderCalendar();
				selectDate(dayStr);
			});
		}

		// ajouter indicateurs de notes (jusqu'à 3 petites pastilles)
		const dayNotes = notes[dayStr] || [];
		const indicators = cell.querySelector('.indicators');
		for (let j = 0; j < Math.min(dayNotes.length, 3); j++) {
			const dot = document.createElement('span');
			dot.className = 'indicator';
			dot.style.background = dayNotes[j].color || '#2b8cff';
			indicators.appendChild(dot);
		}
		if (dayNotes.length > 3) {
			const more = document.createElement('span');
			more.className = 'indicator';
			more.style.width = '26px';
			more.style.height = '10px';
			more.style.borderRadius = '6px';
			more.style.display = 'inline-block';
			more.style.background = 'linear-gradient(90deg, rgba(0,0,0,0.06), rgba(0,0,0,0.02))';
			more.style.opacity = '0.6';
			more.title = `${dayNotes.length} notes`;
			indicators.appendChild(more);
		}

		calendarGrid.appendChild(cell);
	}
}

/** Sélectionne une date et affiche les notes associées */
function selectDate(dateStr) {
	selectedDate = dateStr;
	const d = new Date(dateStr + 'T00:00:00');
	const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
	selectedDateHeading.textContent = d.toLocaleDateString('fr-FR', options).replace(/^./, s => s.toUpperCase());
	// Mettre à jour le formulaire de note si modal ouvert
	noteDateInput.value = dateStr;
	// Appliquer une teinte légère à la grille pour indiquer la sélection
	calendarGrid.classList.add('grid-highlight');
	// Re-rendre le calendrier pour mettre en évidence
	renderCalendar();
	renderNotes();
}

/** Rend la liste des notes pour la date sélectionnée */
function renderNotes() {
	notesList.innerHTML = '';
	if (!selectedDate) {
		selectedDateHeading.textContent = 'Sélectionnez une date';
		return;
	}
	const dayNotes = (notes[selectedDate] || []).slice().sort((a,b) => {
		if (a.time && b.time) return a.time.localeCompare(b.time);
		if (a.time) return -1;
		if (b.time) return 1;
		return 0;
	});

	// appliquer filtre si demandé
	const filteredNotes = dayNotes.filter(n => !showOnlyUnvalidated || !n.done);

	if (filteredNotes.length === 0) {
		const empty = document.createElement('div');
		empty.className = 'card';
		empty.style.padding = '14px';
		empty.textContent = "Aucune note pour cette date.";
		notesList.appendChild(empty);
		return;
	}

	dayNotes.forEach(n => {
		// si filtré, skip
		if (showOnlyUnvalidated && n.done) return;
		const item = document.createElement('div');
		item.className = 'note-item';
		if (n.done) item.classList.add('done');
		if (n.manualUnvalidated) item.classList.add('unvalidated');
		item.innerHTML = `
			<div class="note-color" style="background:${escapeHTML(n.color || '#2b8cff')};"></div>
			<div class="note-body">
				<div class="note-meta"><div class="note-time">${n.time ? escapeHTML(n.time) : ''}</div></div>
				<h3 class="note-title">${escapeHTML(n.title)}</h3>
				<div class="note-desc">${escapeHTML(n.description || '')}</div>
			</div>
		`;
		const actions = document.createElement('div');
		actions.className = 'note-actions';
		const validateBtn = document.createElement('button');
		validateBtn.className = 'btn';
		validateBtn.textContent = 'Valider';
		validateBtn.setAttribute('aria-label', 'Valider la note');
		validateBtn.addEventListener('click', () => setNoteDone(n.id, true));
		const unvalidateBtn = document.createElement('button');
		unvalidateBtn.className = 'btn';
		unvalidateBtn.textContent = 'Non valider';
		unvalidateBtn.setAttribute('aria-label', 'Marquer la note comme non validée');
		unvalidateBtn.addEventListener('click', () => setNoteDone(n.id, false));
		const editBtn = document.createElement('button');
		editBtn.className = 'btn';
		editBtn.textContent = 'Modifier';
		editBtn.addEventListener('click', () => openNoteModal(n.id));
		const delBtn = document.createElement('button');
		delBtn.className = 'btn';
		delBtn.textContent = 'Supprimer';
		delBtn.addEventListener('click', () => deleteNote(n.id));
		actions.appendChild(validateBtn);
		actions.appendChild(unvalidateBtn);
		actions.appendChild(editBtn);
		actions.appendChild(delBtn);
		item.appendChild(actions);
		notesList.appendChild(item);
	});
}

/** Basculer le statut 'done' d'une note */
function toggleValidate(id) {
	for (const d in notes) {
		const idx = notes[d].findIndex(n => n.id === id);
		if (idx >= 0) {
			notes[d][idx].done = !notes[d][idx].done;
			saveNotesStorage(notes);
			renderCalendar();
			if (selectedDate === d) renderNotes();
			showToast(notes[d][idx].done ? 'Note validée.' : 'Validation annulée.');
			return;
		}
	}
}

/** Définit explicitement le statut 'done' d'une note */
function setNoteDone(id, value) {
	for (const d in notes) {
		const idx = notes[d].findIndex(n => n.id === id);
		if (idx >= 0) {
			notes[d][idx].done = !!value;
			// si on marque non validée explicitement, ajouter flag manualUnvalidated
			if (!value) {
				notes[d][idx].manualUnvalidated = true;
			} else {
				// si validée, supprimer le flag manualUnvalidated
				if (notes[d][idx].manualUnvalidated) delete notes[d][idx].manualUnvalidated;
			}
			saveNotesStorage(notes);
			renderCalendar();
			if (selectedDate === d) renderNotes();
			showToast(notes[d][idx].done ? 'Note validée.' : 'Note marquée non validée.');
			return;
		}
	}
}

// ----- Modal et gestion des notes -----

/** Ouvre la modale. Si noteId fourni, charge la note pour modification. */
function openNoteModal(noteId = null) {
	titleError.hidden = true;
	if (noteId) {
		// trouver note et préremplir
		let found = null;
		for (const d in notes) {
			found = notes[d].find(n => n.id === noteId);
			if (found) break;
		}
		if (!found) return;
		noteIdInput.value = found.id;
		noteDateInput.value = found.date;
		noteTitleInput.value = found.title;
		noteTimeInput.value = found.time || '';
		noteColorInput.value = found.color || '#2b8cff';
		noteDescInput.value = found.description || '';
	} else {
		noteIdInput.value = '';
		// si une date est sélectionnée, préremplir
		noteDateInput.value = selectedDate || toISODateLocal(new Date());
		noteTitleInput.value = '';
		noteTimeInput.value = '';
		noteColorInput.value = '#2b8cff';
		noteDescInput.value = '';
	}
	modal.classList.add('show');
	modal.setAttribute('aria-hidden', 'false');
	// focus sur titre
	setTimeout(() => noteTitleInput.focus(), 120);
}

/** Ferme la modale */
function closeModal() {
	modal.classList.remove('show');
	modal.setAttribute('aria-hidden', 'true');
}

/** Valide le formulaire de note */
function validateNoteForm() {
	const title = noteTitleInput.value || '';
	// titre obligatoire, pas que des espaces
	if (!title.trim()) {
		titleError.textContent = 'Le titre est obligatoire et ne peut pas être vide.';
		titleError.hidden = false;
		noteTitleInput.focus();
		return false;
	}
	titleError.hidden = true;
	return true;
}

/** Sauvegarde une note (création ou modification) */
function saveNote(e) {
	e.preventDefault();
	if (!validateNoteForm()) return;
	const id = noteIdInput.value || uid();
	const date = noteDateInput.value;
	const title = noteTitleInput.value.trim();
	const time = noteTimeInput.value || '';
	const color = noteColorInput.value || '#2b8cff';
	const description = noteDescInput.value.trim();

	// préserver le statut 'done' si modification
	let prevDone = false;
	let prevManualUnvalidated = false;
	if (noteIdInput.value) {
		for (const d in notes) {
			const found = notes[d].find(n => n.id === noteIdInput.value);
			if (found) { prevDone = !!found.done; break; }
		}
	}
	// récupérer aussi le flag manualUnvalidated si existant
	if (noteIdInput.value) {
		for (const d in notes) {
			const found = notes[d].find(n => n.id === noteIdInput.value);
			if (found) { prevManualUnvalidated = !!found.manualUnvalidated; break; }
		}
	}
	const noteObj = { id, date, title, time, color, description, done: prevDone, manualUnvalidated: prevManualUnvalidated };

	// si modification : remplacer la note existante
	let modified = false;
	const existing = notes[date] || [];
	// remove old instance if exists elsewhere
	for (const d in notes) {
		const idx = notes[d].findIndex(n => n.id === id);
		if (idx >= 0) {
			notes[d].splice(idx, 1);
			if (notes[d].length === 0) delete notes[d];
			modified = true;
		}
	}
	// ajouter dans la date choisie
	if (!notes[date]) notes[date] = [];
	notes[date].push(noteObj);

	saveNotesStorage(notes);
	renderCalendar();
	// si la note concerne la date sélectionnée, recharger les notes
	if (selectedDate === date) renderNotes();
	// si on a modifié la date sélectionnée, sélectionner la nouvelle date
	if (selectedDate !== date) {
		selectDate(date);
	}
	closeModal();
	showToast(modified ? 'Note modifiée.' : 'Note ajoutée.');
}

/** Ouvre la modale pour modification en cherchant la note par id */
function editNote(id) {
	openNoteModal(id);
}

/** Supprime une note après confirmation */
function deleteNote(id) {
	if (!confirm('Voulez-vous vraiment supprimer cette note ?')) return;
	// trouver et supprimer
	for (const d in notes) {
		const idx = notes[d].findIndex(n => n.id === id);
		if (idx >= 0) {
			notes[d].splice(idx, 1);
			if (notes[d].length === 0) delete notes[d];
			saveNotesStorage(notes);
			// re-render
			renderCalendar();
			if (selectedDate === d) renderNotes();
			showToast('Note supprimée.');
			return;
		}
	}
}

// ----- Navigation -----

prevBtn.addEventListener('click', () => {
	current = new Date(current.getFullYear(), current.getMonth() - 1, 1);
	renderCalendar();
});
nextBtn.addEventListener('click', () => {
	current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
	renderCalendar();
});
todayBtn.addEventListener('click', () => {
	current = new Date();
	renderCalendar();
	selectDate(toISODateLocal(new Date()));
});

// add note button
addNoteBtn.addEventListener('click', () => openNoteModal(null));

// filter buttons
filterAllBtn.addEventListener('click', () => {
	showOnlyUnvalidated = false;
	filterAllBtn.classList.add('active');
	filterUnvalidatedBtn.classList.remove('active');
	renderNotes();
});
filterUnvalidatedBtn.addEventListener('click', () => {
	showOnlyUnvalidated = true;
	filterAllBtn.classList.remove('active');
	filterUnvalidatedBtn.classList.add('active');
	renderNotes();
});

// clear saved notes from localStorage
clearDataBtn.addEventListener('click', () => {
	if (!confirm('Voulez-vous vraiment supprimer toutes les notes enregistrées dans ce navigateur ?')) {
		return;
	}
	localStorage.removeItem(STORAGE_KEY);
	notes = {};
	selectedDate = toISODateLocal(new Date());
	renderCalendar();
	renderNotes();
	showToast('Toutes les données ont été supprimées.');
});

// modal controls
closeModalBtn.addEventListener('click', closeModal);
modalBackdrop.addEventListener('click', closeModal);
cancelBtn.addEventListener('click', closeModal);

// ESC key closes modal
document.addEventListener('keydown', (e) => {
	if (e.key === 'Escape') {
		if (modal.classList.contains('show')) closeModal();
	}
});

// form submit
noteForm.addEventListener('submit', saveNote);

// initialisation
(function init() {
	// définir la date courante sur le premier du mois courant
	current = new Date();
	current = new Date(current.getFullYear(), current.getMonth(), 1);

	// selectionner aujourd'hui par defaut
	const today = toISODateLocal(new Date());
	selectedDate = today;

	renderCalendar();
	selectDate(today);
})();

