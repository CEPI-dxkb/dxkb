interface FooterHeaderProps {
  title: string
}

const FooterHeader = ({ title }: FooterHeaderProps) => {
  return (
    <div
        id="title-header"
        className="bg-gradient-to-b from-primary to-background flex h-32 md:h-48 w-full items-center justify-center rounded-b-xl text-white"
      >
        <h1 id="title" className="text-center text-2xl md:text-4xl font-bold">
          {title}
        </h1>
      </div>
  )
}

export default FooterHeader