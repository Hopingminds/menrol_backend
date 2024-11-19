/**
 * Function to generate the current date and time
 * @returns {string} Current date and time
 */
const currentDateTime = () => {
    const date = new Date();
    const currentDateTime = date.toLocaleString([], { hour12: true });

    return currentDateTime;
};

export default currentDateTime;
  