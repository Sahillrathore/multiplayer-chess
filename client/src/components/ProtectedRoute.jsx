import { useSelector } from "react-redux";
import { Navigate } from "react-router-dom";

const ProtectedRoute = ({ children }) => {
  const { token } = useSelector((s) => s.auth);
  const isAuthed = !!token;

  // if no token → redirect to login
  if (!isAuthed) return <Navigate to="/login" replace />;

  return children; // else render actual page
};

export default ProtectedRoute;
