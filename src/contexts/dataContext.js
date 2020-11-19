import React, { useEffect, useState } from 'react';

// this loading should be ideally done in an `useEffect` which will enable async loading,
// but doesn't work that way for some strange reason
const defaultData = JSON.parse(localStorage.getItem('data') || '{}');

export const DataContext = React.createContext({
  data: defaultData,
  setData: () => null,
});

export function DataProvider(props) {
  const [data, setData] = useState(defaultData);

  useEffect(() => {
    localStorage.setItem('data', JSON.stringify(data));
  }, [data]);
  return (
    <DataContext.Provider value={{ data, setData }}>
      {props.children}
    </DataContext.Provider>
  );
}
