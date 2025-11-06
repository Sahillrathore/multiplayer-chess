import { useState } from "react";
import { FaBolt, FaChessKnight, FaStopwatch, FaHourglassHalf } from "react-icons/fa";
import { IoChevronDown } from "react-icons/io5";
import { useDispatch } from "react-redux";
import { setTimeControl} from '../../src/store/slices/gameSlice';

export default function TimeControlSelect({ tcSeconds, isAuthed, status, isQueueing, findMatch, cancelQueue }) {
  const dispatch = useDispatch();
  const [open, setOpen] = useState(false);

  const options = [
    { value: 60, label: "1 min (Bullet)", icon: <FaBolt /> },
    { value: 180, label: "3 min (Blitz)", icon: <FaChessKnight /> },
    { value: 300, label: "5 min (Blitz)", icon: <FaStopwatch /> },
    { value: 600, label: "10 min (Rapid)", icon: <FaHourglassHalf /> },
  ];

  const currentOption = options.find((opt) => opt.value === tcSeconds);

  return (
    <div className="mb-3 px-0 mt-5 w-full">
      <div className="flex items-center gap-0 flex-col relative">
        {/* Custom Select */}
        <div
          className="w-full bg-[#323232] rounded-lg border border-white/10 px-4 py-3 text-sm cursor-pointer flex justify-between items-center"
          onClick={() => setOpen(!open)}
        >
          <div className="flex items-center gap-2">
            {currentOption?.icon}
            <span>{currentOption?.label}</span>
          </div>
          <IoChevronDown className={`transition-transform ${open ? "rotate-180" : ""}`} />
        </div>

        {open && (
          <div className="absolute top-[40%] mt-2 w-full bg-[#3a3a3a] rounded-lg border border-white/10 shadow-lg z-10 overflow-hidden animate-fadeIn">
            {options.map((opt) => (
              <div
                key={opt.value}
                onClick={() => {
                  dispatch(setTimeControl(opt.value));
                  setOpen(false);
                }}
                className={`flex items-center gap-2 px-4 py-2 text-sm cursor-pointer hover:bg-white/10 transition-colors ${
                  tcSeconds === opt.value ? "bg-white/10" : ""
                }`}
              >
                {opt.icon}
                <span>{opt.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Buttons */}
        <button
          onClick={findMatch}
          disabled={!isAuthed || status === "active" || isQueueing}
          className="rounded-lg w-full px-3 py-2 mt-2 bg-emerald-600 text-lg font-bold disabled:opacity-60"
        >
          Start Game
        </button>

        {isQueueing && (
          <button
            onClick={cancelQueue}
            className="rounded-xl px-3 py-1 mt-2 bg-rose-600 text-xs"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
