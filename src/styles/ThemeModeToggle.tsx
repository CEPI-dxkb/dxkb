// import { useTheme } from "next-themes";
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// export default function ThemeModeToggle() {
//   const { setTheme, theme } = useTheme();
//   const themes = [
//     'zinc-light',
//     'zinc-dark',
//     'orange-light',
//     'orange-dark',
//     'violet-light',
//     'violet-dark',
//     'dxkb-light',
//     'dxkb-dark'
//   ];

//   return (
//     <div className="flex items-center gap-2">
//       {/* <Button
//         variant="outline"
//         size="icon"
//         className="h-full titlebar-button focus-visible:ring-0 bg-transparent hover:bg-transparent border-0
//           hover:brightness-150 hover:shadow-none hover:border-0 duration-500 ease-in-out transition-all"
//         onClick={() => {
//           setTheme('');
//         }}
//       >
//         <Sun
//           className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all text-foreground
//           dark:-rotate-90 dark:scale-0"
//         />
//         <Moon
//           className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0
//           dark:scale-100 text-foreground"
//         />
//         <span className="sr-only">Toggle Theme</span>
//       </Button> */}

//       <Select value={theme} onValueChange={(value) => {
//         setTheme(value);
//       }}>
//         <SelectTrigger className="w-[120px]">
//           <SelectValue placeholder="Theme" />
//         </SelectTrigger>
//         <SelectContent>
//           {themes.map((theme) => (
//             <SelectItem key={theme} value={theme}>
//               {theme}
//             </SelectItem>
//           ))}
//         </SelectContent>
//       </Select>
//     </div>
//   )
// }