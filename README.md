# YardSense

**natHacks 2026 · Construction & Manufacturing track**

Equipment decisions in a group of companies are made project by project, by phone, so rental money leaves the group while the group's own equipment sits idle. YardSense tells the equipment coordinator what to do for each request: **move a unit the group owns**, **rent from the group's rental company**, **rent outside**, or **have the rental company buy it**. It picks the cheapest option for the *whole group*, looking across every upcoming project. No trackers: it reads the SAP, Procore and Textura data a contractor already has.

> All project code is written during natHacks 2026 (Nov 6–9). The demo uses a fictional company group (**Northgate Group**) and synthetic data.

## Repo layout

```
backend/      FastAPI app (Python 3.12)
frontend/     React + Vite app (Node 24)
data/seed/    fictional Northgate Group seed data (committed)
data/private/ real numbers for tuning; gitignored, never commit
docs/         design notes
pitch/        deck, script, demo video
```

## Requirements

| Tool | Version | Check |
|---|---|---|
| Python | **3.12** (see `.python-version`) | `python --version` (Windows) / `python3 --version` (macOS) |
| Node.js | **24 LTS** (see `.nvmrc`) | `node -v` |
| Git | any recent | `git --version` |

Install Python from [python.org](https://www.python.org/downloads/) (on Windows, tick **"Add python.exe to PATH"**). Install Node 24 with [nvm](https://github.com/nvm-sh/nvm) on macOS (`nvm install 24`), [nvm-windows](https://github.com/coreybutler/nvm-windows) on Windows (`nvm install 24` then `nvm use 24`), or the LTS installer from [nodejs.org](https://nodejs.org/).
## Team
| Name | Role |
|---|---|
| Gurshmeer Singh | TBD |
| Rakshit | TBD |
| Sreeman | TBD |
| Aarish | TBD |
| Anant | TBD |

## Run

You need **two terminals**: one for the backend, one for the frontend.

### 1. Clone

```bash
git clone https://github.com/singhg349-wq/yardsense-nathacks26.git
cd yardsense-nathacks26
```

### 2. Backend (terminal 1)

**macOS**

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

**Windows (PowerShell)**

```powershell
cd backend
py -3.12 -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```

> If PowerShell says running scripts is disabled, run this once, then activate again:
> `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`
> In Command Prompt (cmd) use `.venv\Scripts\activate.bat` instead.

You can name your venv something other than `.venv`, but add that folder name to the root `.gitignore` so it is never committed.

Check it: open <http://localhost:8000/health>. You should see `{"status":"ok",...}`. API docs are at <http://localhost:8000/docs>.

Next time you only need to activate the venv (`source .venv/bin/activate` or `.venv\Scripts\Activate.ps1`) and run `uvicorn app.main:app --reload`.

### 3. Frontend (terminal 2, same on macOS and Windows)

```bash
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173>. It should show **Backend: ok**. If it says *unreachable*, the backend isn't running in terminal 1.

## Troubleshooting

- **`python3.12` / `py -3.12` not found:** Python 3.12 isn't installed or isn't on PATH. Reinstall it from python.org.
- **Port 5173 or 8000 already in use:** stop the other process (an old `npm run dev` / `uvicorn` in another terminal).
- **Frontend shows "unreachable":** the backend must be running on port 8000. To point at another URL, copy `frontend/.env.example` to `frontend/.env` and edit `VITE_API_URL`.
- **`npm install` warns about the Node engine:** you're not on Node 24. Run `nvm use 24`.

## Adding dependencies

- **Backend:** `pip install <pkg>`, then add `<pkg>==<version>` to `backend/requirements.txt` by hand. Don't paste `pip freeze` output: it pins macOS-only packages that break Windows installs.
- **Frontend:** `npm install <pkg>` updates `package.json` and `package-lock.json`. Commit both.

## Credits

Team: Gurshmeer, Rakshit, Sreeman, Aarish, Anant. Industry guidance from a construction professional (not a team member).
