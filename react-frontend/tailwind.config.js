// Theme colors are CSS variables holding full oklch() values, so Tailwind can't
// inject an alpha channel itself. color-mix() makes opacity modifiers like
// bg-muted/40 work; without a modifier <alpha-value> is 1 (the solid color).
const withAlpha = (name) =>
  `color-mix(in oklab, var(--${name}) calc(<alpha-value> * 100%), transparent)`;

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
  	extend: {
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		colors: {
  			background: withAlpha('background'),
  			foreground: withAlpha('foreground'),
  			card: {
  				DEFAULT: withAlpha('card'),
  				foreground: withAlpha('card-foreground')
  			},
  			popover: {
  				DEFAULT: withAlpha('popover'),
  				foreground: withAlpha('popover-foreground')
  			},
  			primary: {
  				DEFAULT: withAlpha('primary'),
  				foreground: withAlpha('primary-foreground')
  			},
  			secondary: {
  				DEFAULT: withAlpha('secondary'),
  				foreground: withAlpha('secondary-foreground')
  			},
  			muted: {
  				DEFAULT: withAlpha('muted'),
  				foreground: withAlpha('muted-foreground')
  			},
  			accent: {
  				DEFAULT: withAlpha('accent'),
  				foreground: withAlpha('accent-foreground')
  			},
  			destructive: {
  				DEFAULT: withAlpha('destructive'),
  				foreground: withAlpha('destructive-foreground')
  			},
  			warning: {
  				DEFAULT: withAlpha('warning'),
  				foreground: withAlpha('warning-foreground')
  			},
  			info: {
  				DEFAULT: withAlpha('info'),
  				foreground: withAlpha('info-foreground')
  			},
  			border: withAlpha('border'),
  			input: withAlpha('input'),
  			ring: withAlpha('ring'),
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			}
  		},
  		keyframes: {
  			indeterminate: {
  				'0%': { transform: 'translateX(-100%)' },
  				'100%': { transform: 'translateX(250%)' }
  			},
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: withAlpha('radix-accordion-content-height')
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: withAlpha('radix-accordion-content-height')
  				},
  				to: {
  					height: '0'
  				}
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out',
  			indeterminate: 'indeterminate 1.4s ease-in-out infinite'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
};
