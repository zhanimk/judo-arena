import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";

const store = configureStore({
    reducer: {},
});

export const StoreProvider = ({ children }) => {
    return <Provider store={store}>{children}</Provider>;
};