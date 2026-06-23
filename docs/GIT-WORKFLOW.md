# Git Workflow

AllyCat uses a simplified Git Flow: feature branches merge into `develop`, and only releases go to `main`.

## 1. Start a New Feature Branch

```bash
git checkout develop
git pull origin develop
git checkout -b feature/your-feature-name
```

## 2. Work, Commit, Push

```bash
git add <files>
git commit -m "feat: short description"
git push -u origin feature/your-feature-name
```

## 3. Merge into Develop and Clean Up

```bash
git checkout develop
git pull origin develop
git merge --no-ff feature/your-feature-name -m "Merge feature/your-feature-name"
git push origin develop
git branch -d feature/your-feature-name
git push origin --delete feature/your-feature-name
```

## 4. Release — Merge Develop into Main

```bash
git checkout main
git pull origin main
git merge --no-ff develop -m "Release: merge develop into main"
git push origin main
```
