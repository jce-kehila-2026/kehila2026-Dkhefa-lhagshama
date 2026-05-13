const VolunteerCard = ({ name, skill, availability }) => {
  return (
    <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100 hover:shadow-lg transition">
      <div className="flex items-center space-x-4">
        <div className="h-12 w-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-xl">
          {name[0]}
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-800">{name}</h3>
          <p className="text-sm text-blue-500 font-medium">{skill}</p>
        </div>
      </div>
      <div className="mt-4">
        <span className={`px-3 py-1 rounded-full text-xs ${availability === 'Available' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {availability}
        </span>
      </div>
      <button className="w-full mt-4 bg-gray-50 text-gray-700 py-2 rounded-lg hover:bg-blue-600 hover:text-white transition">
        View Profile
      </button>
    </div>
  );
};

export default VolunteerCard;