export type ChatPreview = {
  id: string;
  name: string;
  snippet: string;
  time: string;
  read: boolean;
  initial: string;
  bg: string;
};

export const CHATS: ChatPreview[] = [
  {
    id: "martin",
    name: "Martin Randolph",
    snippet: "You: What’s man!",
    time: "9:40 AM",
    read: false,
    initial: "M",
    bg: "#c7a987",
  },
  {
    id: "andrew",
    name: "Andrew Parker",
    snippet: "You: Ok, thanks!",
    time: "9:25 AM",
    read: true,
    initial: "A",
    bg: "#d4a574",
  },
  {
    id: "karen",
    name: "Karen Castillo",
    snippet: "You: Ok, See you in To…",
    time: "Fri",
    read: true,
    initial: "K",
    bg: "#b8b8b8",
  },
  {
    id: "joshua",
    name: "Joshua Lawrence",
    snippet: "The business plan loo…",
    time: "Thu",
    read: false,
    initial: "J",
    bg: "#7a8a9b",
  },
  {
    id: "maisy",
    name: "Maisy Humphrey",
    snippet: "Have a good day, Maisy!",
    time: "Fri",
    read: true,
    initial: "M",
    bg: "#9a8b7e",
  },
];

export type Bubble = {
  side: "them" | "me";
  text: string;
  width?: number;
};

export const BUBBLES: Bubble[] = [
  {
    side: "them",
    text: "I don’t know why people are so anti pineapple pizza. I kind of like it.",
  },
  {
    side: "me",
    text:
      "That’s perfect. There’s a new place on Main St I’ve been wanting to check out. I hear their hawaiian pizza is off the hook!",
  },
  {
    side: "them",
    text: "Let’s do it! I’m in a meeting until noon.",
  },
  {
    side: "me",
    text: "Let’s get lunch. How about pizza?",
    width: 300,
  },
];
