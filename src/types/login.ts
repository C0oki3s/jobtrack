export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  status: boolean;
  success: boolean;
  token: string;
  refreshToken: string;
  user: {
    user_name: string;
    role: {
      permissions: {
        readASM: boolean;
        readDarkweb: boolean;
        writeASM: boolean;
        writeDarkweb: boolean;
        manageUsers: boolean;
      };
      name: string;
      _id: string;
    };
    organization: {
      _id: string;
      name: string;
    };
  };
  message: string;
}