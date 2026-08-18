import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { conversationAPI } from "../services/api";
import type { Poll } from "../types";

interface PollCardProps {
  poll: Poll;
  conversationId: string;
}

export default function PollCard({ poll, conversationId }: PollCardProps) {
  const { user } = useAuth();
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [voting, setVoting] = useState(false);

  const totalVotes = poll.options.reduce((sum, opt) => sum + opt.votes.length, 0);

  const myVote = poll.options.find((opt) =>
    opt.votes.some((v) => v === user?._id)
  );

  const handleVote = async (optionId: string) => {
    if (poll.closed || voting) return;
    setVoting(true);
    try {
      await conversationAPI.votePoll(conversationId, poll._id, optionId);
      setSelectedOption(optionId);
    } catch (err) {
      console.error(err);
    } finally {
      setVoting(false);
    }
  };

  const handleClose = async () => {
    try {
      await conversationAPI.closePoll(conversationId, poll._id);
    } catch (err) {
      console.error(err);
    }
  };

  const isCreator = poll.createdBy === user?._id;

  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 max-w-sm">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">📊</span>
        <h4 className="text-sm font-semibold text-white flex-1">{poll.question}</h4>
        {poll.closed && (
          <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded">Closed</span>
        )}
      </div>

      <div className="space-y-2">
        {poll.options.map((opt) => {
          const pct = totalVotes > 0 ? Math.round((opt.votes.length / totalVotes) * 100) : 0;
          const isSelected = myVote?._id === opt._id || selectedOption === opt._id;

          return (
            <button
              key={opt._id}
              onClick={() => handleVote(opt._id)}
              disabled={poll.closed}
              className={`w-full text-left rounded-lg p-2.5 border transition-all relative overflow-hidden ${
                isSelected
                  ? "border-blue-500 bg-blue-500/10"
                  : "border-gray-600 hover:border-gray-500 bg-gray-700/50"
              } ${poll.closed ? "cursor-default" : "cursor-pointer"}`}
            >
              <div
                className="absolute inset-0 bg-blue-500/20 transition-all"
                style={{ width: `${pct}%` }}
              />
              <div className="relative flex items-center justify-between">
                <span className="text-xs text-white">{opt.text}</span>
                <span className="text-[10px] text-gray-400 font-medium">
                  {opt.votes.length} ({pct}%)
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-700">
        <span className="text-[10px] text-gray-500">{totalVotes} votes</span>
        {isCreator && !poll.closed && (
          <button
            onClick={handleClose}
            className="text-[10px] text-red-400 hover:text-red-300 font-medium"
          >
            Close poll
          </button>
        )}
      </div>
    </div>
  );
}
