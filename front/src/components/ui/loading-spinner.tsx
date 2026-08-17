import { Spinner } from './spinner';

type LoadingSpinnerProps = React.ComponentProps<typeof Spinner>;

export function LoadingSpinner({ size = 'sm', ...props }: LoadingSpinnerProps) {
  return <Spinner size={size} {...props} />;
}
