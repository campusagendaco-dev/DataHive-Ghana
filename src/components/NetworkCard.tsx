interface NetworkCardProps {
  name: string;
  color?: string;
  selected?: boolean;
  onClick?: () => void;
}

const NetworkCard = ({ name, selected, onClick }: NetworkCardProps) => (
  <button
    onClick={onClick}
    className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-colors ${
      selected
        ? "bg-amber-400 border-amber-400 text-black"
        : "border-gray-300 text-black hover:border-amber-400"
    }`}
  >
    {name}
  </button>
);

export default NetworkCard;
