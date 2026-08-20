import { Platform } from "react-native";
import {
  HStack,
  Image,
  Spacer,
  Text,
  VStack,
  background,
  clipToContainer,
  font,
  foregroundStyle,
  padding,
  widgetURL,
} from "~/infra/widgets/expo-swift-ui";
import {
  after,
  createLiveActivity,
  createWidget,
  type LiveActivity,
  type LiveActivityEnvironment,
  type WidgetEnvironment,
} from "expo-widgets";

export const STUDIENBUCH_SUMMARY_WIDGET = "StudienbuchSummaryWidget";
export const STUDIENBUCH_STUDY_SESSION_ACTIVITY = "StudienbuchStudySessionActivity";

export type StudienbuchWidgetSnapshot = {
  openTaskCount: number;
  nextTaskTitle: string;
  nextTaskContext: string;
  statusLine: string;
};

export type StudienbuchStudySessionActivityProps = {
  title: string;
  location: string;
  status: string;
  endsAt: number;
};

const accent = "#4F9449";
const ink = "#172033";
const muted = "#687386";
const canvas = "#F7FBF6";

const defaultSnapshot: StudienbuchWidgetSnapshot = {
  openTaskCount: 0,
  nextTaskTitle: "Alles erledigt",
  nextTaskContext: "Keine offenen Aufgaben",
  statusLine: "Studienbuch ist bereit",
};

const SummaryWidget = (props: StudienbuchWidgetSnapshot, environment: WidgetEnvironment) => {
  "widget";

  const isCompact = environment.widgetFamily === "systemSmall";

  return (
    <VStack
      alignment="leading"
      spacing={isCompact ? 6 : 10}
      modifiers={[
        padding({ all: isCompact ? 14 : 16 }),
        background(canvas),
        clipToContainer("containerRelativeShape"),
        widgetURL("studienbuch://"),
      ]}
    >
      <HStack spacing={8}>
        <Image systemName="book.closed.fill" color={accent} size={isCompact ? 18 : 20} />
        <Text
          modifiers={[font({ weight: "bold", size: isCompact ? 14 : 16 }), foregroundStyle(ink)]}
        >
          Studienbuch
        </Text>
        <Spacer />
        <Text
          modifiers={[font({ weight: "bold", size: isCompact ? 22 : 28 }), foregroundStyle(accent)]}
        >
          {props.openTaskCount}
        </Text>
      </HStack>

      <VStack alignment="leading" spacing={4}>
        <Text
          modifiers={[
            font({ weight: "semibold", size: isCompact ? 15 : 17 }),
            foregroundStyle(ink),
          ]}
        >
          {props.nextTaskTitle}
        </Text>
        <Text modifiers={[font({ size: 12 }), foregroundStyle(muted)]}>
          {props.nextTaskContext}
        </Text>
      </VStack>

      {!isCompact ? (
        <Text modifiers={[font({ size: 12 }), foregroundStyle(muted)]}>{props.statusLine}</Text>
      ) : null}
    </VStack>
  );
};

const StudySessionActivity = (
  props: StudienbuchStudySessionActivityProps,
  environment: LiveActivityEnvironment,
) => {
  "widget";

  const foreground = environment.colorScheme === "dark" ? "#FFFFFF" : ink;

  const banner = (
    <HStack spacing={12} modifiers={[padding({ all: 14 })]}>
      <Image systemName="timer.circle.fill" color={accent} size={28} />
      <VStack alignment="leading" spacing={3}>
        <Text modifiers={[font({ weight: "bold", size: 16 }), foregroundStyle(foreground)]}>
          {props.title}
        </Text>
        <Text modifiers={[font({ size: 13 }), foregroundStyle(muted)]}>{props.status}</Text>
      </VStack>
      <Spacer />
      <Text
        date={new Date(props.endsAt)}
        dateStyle="relative"
        modifiers={[font({ weight: "semibold", size: 14 }), foregroundStyle(accent)]}
      />
    </HStack>
  );

  return {
    banner,
    compactLeading: <Image systemName="book.closed.fill" color={accent} />,
    compactTrailing: (
      <Text
        date={new Date(props.endsAt)}
        dateStyle="relative"
        modifiers={[font({ weight: "semibold", size: 12 }), foregroundStyle(foreground)]}
      />
    ),
    minimal: <Image systemName="book.closed.fill" color={accent} />,
    expandedLeading: (
      <VStack alignment="center" spacing={4} modifiers={[padding({ all: 10 })]}>
        <Image systemName="book.closed.fill" color={accent} size={24} />
        <Text modifiers={[font({ size: 11 }), foregroundStyle(muted)]}>Lernen</Text>
      </VStack>
    ),
    expandedCenter: banner,
    expandedBottom: (
      <Text modifiers={[font({ size: 13 }), foregroundStyle(muted)]}>{props.location}</Text>
    ),
  };
};

export const StudienbuchSummaryWidget = createWidget<StudienbuchWidgetSnapshot>(
  STUDIENBUCH_SUMMARY_WIDGET,
  SummaryWidget,
);

export const StudienbuchStudySessionActivity =
  createLiveActivity<StudienbuchStudySessionActivityProps>(
    STUDIENBUCH_STUDY_SESSION_ACTIVITY,
    StudySessionActivity,
  );

export function publishStudienbuchWidgetSnapshot(snapshot: StudienbuchWidgetSnapshot) {
  if (Platform.OS !== "ios") {
    return;
  }

  StudienbuchSummaryWidget.updateSnapshot(snapshot);
}

export function publishDefaultStudienbuchWidgetSnapshot() {
  publishStudienbuchWidgetSnapshot(defaultSnapshot);
}

export function startStudienbuchStudySessionActivity(props: StudienbuchStudySessionActivityProps) {
  if (Platform.OS !== "ios") {
    return undefined;
  }

  return StudienbuchStudySessionActivity.start(props, "studienbuch://schedule");
}

export async function endStudienbuchStudySessionActivity(
  activity: LiveActivity<StudienbuchStudySessionActivityProps> | undefined,
  props: StudienbuchStudySessionActivityProps,
) {
  if (!activity) {
    return;
  }

  await activity.end(after(new Date(Date.now() + 15 * 60 * 1000)), props, new Date());
}
