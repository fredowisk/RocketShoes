import {
  createContext,
  ReactNode,
  useContext,
  useState,
  useEffect,
  useRef,
} from "react";
import { toast } from "react-toastify";
import { api } from "../services/api";
import { Product, Stock } from "../types";

interface CartProviderProps {
  children: ReactNode;
}

interface UpdateProductAmount {
  productId: number;
  amount: number;
}

interface StockAmount {
  [key: number]: number;
}

interface CartContextData {
  cart: Product[];
  stock: StockAmount;
  addProduct: (productId: number) => Promise<void>;
  removeProduct: (productId: number) => void;
  updateProductAmount: ({
    productId,
    amount,
  }: UpdateProductAmount) => Promise<void>;
}

const CartContext = createContext<CartContextData>({} as CartContextData);

export function CartProvider({ children }: CartProviderProps): JSX.Element {
  const [cart, setCart] = useState<Product[]>(() => {
    const storedCart = localStorage.getItem("@RocketShoes:cart");

    if (storedCart) {
      return JSON.parse(storedCart);
    }

    return [];
  });
  const [stock, setStock] = useState<StockAmount>({});

  const loadStocks = async (): Promise<void> => {
    const { data } = await api.get<Stock[]>(`/stock`);

    const stockAmount = data.reduce((sumAmount, stock) => {
      sumAmount[stock.id] = stock.amount;
      return sumAmount;
    }, {} as StockAmount);

    setStock(stockAmount);
  };

  const prevCartRef = useRef<Product[]>();
  const prevStockRef = useRef<StockAmount>();

  useEffect(() => {
    prevCartRef.current = cart;
    prevStockRef.current = stock;
  });

  const cartPreviousValue = prevCartRef.current ?? cart;
  const stockPreviousValue = prevStockRef.current ?? stock;

  useEffect(() => {
    if (cartPreviousValue !== cart) {
      localStorage.setItem("@RocketShoes:cart", JSON.stringify(cart));
    }
  }, [cart, cartPreviousValue]);

  useEffect(() => {
    if (stockPreviousValue !== stock) {
      loadStocks();
    }
  }, [stock, stockPreviousValue]);

  const getProduct = async (productId: number): Promise<Product> => {
    const { data: product } = await api.get<Product>(`products/${productId}`);

    return product;
  };

  const getStock = async (productId: number): Promise<Stock> => {
    const { data: stock } = await api.get<Stock>(`stock/${productId}`);

    return stock;
  };

  const addProduct = async (productId: number): Promise<void> => {
    try {
      const updatedCart = [...cart];

      const product = await getProduct(productId);

      if (!product) {
        toast.error("Erro na adição do produto");
        return;
      }

      const productExists = updatedCart.find(
        (cartProduct) => cartProduct.id === productId
      );

      if (!productExists) {
        product.amount = 1;
        setCart([...updatedCart, product]);
        return;
      }

      const { amount } = await getStock(productId);

      if (productExists.amount >= amount) {
        toast.error("Quantidade solicitada fora de estoque");
        return;
      }

      productExists.amount++;

      setCart(updatedCart);
    } catch {
      toast.error("Erro na adição do produto");
    }
  };

  const removeProduct = (productId: number): void => {
    try {
      const updatedCart = [...cart];
      const productIndex = updatedCart.findIndex(
        (product) => product.id === productId
      );

      if (productIndex < 0) throw Error();

      updatedCart.splice(productIndex, 1);

      setCart(updatedCart);
    } catch {
      toast.error("Erro na remoção do produto");
    }
  };

  const updateProductAmount = async ({
    productId,
    amount,
  }: UpdateProductAmount): Promise<void> => {
    try {
      if (amount < 1) throw Error();

      const { amount: stockAmount } = await getStock(productId);

      if (stockAmount < amount) {
        toast.error("Quantidade solicitada fora de estoque");
        return;
      }

      const updatedCart = [...cart];
      const productExists = updatedCart.find(
        (product) => product.id === productId
      );

      if (!productExists) throw Error();

      productExists.amount = amount;

      setCart(updatedCart);
    } catch {
      toast.error("Erro na alteração de quantidade do produto");
    }
  };

  return (
    <CartContext.Provider
      value={{ cart, stock, addProduct, removeProduct, updateProductAmount }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextData {
  const context = useContext(CartContext);

  return context;
}
