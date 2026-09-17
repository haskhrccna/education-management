import { Redirect } from 'expo-router';

/**
 * Overrides expo-router's built-in `/_sitemap` developer screen.
 *
 * That screen is generated automatically whenever the app does NOT define this
 * route, and it renders the app's entire route tree **by source file name**
 * — `(auth)/index.tsx`, `admin/audit-logs.tsx`, `teacher/grade-form.tsx` and
 * so on. On the published web build that is a public listing of the codebase's
 * internal structure, reachable by anyone who guesses the URL. The web app
 * exists to serve students, teachers and parents; it should expose nothing
 * about how it is built.
 *
 * Defining the route here replaces the generated one (expo-router only adds
 * its system route when `app/_sitemap` is absent), so the URL now behaves like
 * any other unknown path: it sends the visitor to the app.
 */
export default function SitemapRoute() {
  return <Redirect href="/" />;
}
