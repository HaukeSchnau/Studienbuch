import { Link, type LinkProps } from "@stu/ui/Link";
import { Link as ExpoLink, type Href } from "expo-router";

export interface RouteLinkProps extends Omit<LinkProps, "href" | "onPress"> {
  readonly href: Href;
  /** Goes back to `href` when it is already on the stack, as "Anmelden" from "Konto erstellen". */
  readonly dismissTo?: boolean;
  /** Runs as the screen changes, as "Abbrechen" ends the sign-up. */
  readonly onPress?: () => void;
}

/**
 * A text link to a screen of the app. On the web it is an anchor the router follows without
 * loading the page, so the tab keeps its state and its `?device=`.
 */
export function RouteLink({ href, dismissTo = false, onPress, ...link }: RouteLinkProps) {
  // `onPress` on expo-router's Link, even an undefined one, replaces the router's own press, and
  // react-native-web's Pressable drops the click handler the Link adds for the web. The anchor then
  // loads the page. On the child, the Link's Slot runs `onPress` first, then the router's.
  return (
    <ExpoLink href={href} dismissTo={dismissTo} asChild>
      <Link {...link} onPress={onPress} />
    </ExpoLink>
  );
}
