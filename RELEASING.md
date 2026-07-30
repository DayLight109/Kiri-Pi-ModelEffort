# Release guide

`Kiri-Pi-ModelEffort` reaches Pi's package gallery through the npm package `kiri-pi-model-effort`. Pi automatically discovers public npm packages whose `keywords` include `pi-package`.

## First release

1. Verify the package:

   ```bash
   npm install
   npm run check
   npm pack --dry-run
   ```

2. Create the public GitHub repository and push this project:

   ```bash
   git remote add origin https://github.com/DayLight109/Kiri-Pi-ModelEffort.git
   git push -u origin main
   ```

3. Authenticate with npm (the current machine must be logged in):

   ```bash
   npm login
   npm whoami
   ```

4. Confirm the package name is still available:

   ```bash
   npm view kiri-pi-model-effort
   ```

   An `E404` response means the unscoped name is available.

5. Publish publicly:

   ```bash
   npm publish --access public
   ```

   If the npm account requires two-factor authentication, npm will request a one-time password.

6. Verify the registry and Pi installation path:

   ```bash
   npm view kiri-pi-model-effort version keywords pi
   pi -e npm:kiri-pi-model-effort
   ```

7. Check the Pi gallery after its index refreshes:

   <https://pi.dev/packages>

## Later releases

Update `CHANGELOG.md`, bump the version, verify, commit, tag, and publish:

```bash
npm version patch   # or minor / major
npm publish --access public
git push --follow-tags
```

Never reuse a published version number. npm releases are immutable.
